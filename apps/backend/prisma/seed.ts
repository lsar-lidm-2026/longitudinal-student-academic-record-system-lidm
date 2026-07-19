/**
 * LSAR Seed v2 — Optimized Batch Insert
 * =======================================
 *
 * Cara Kerja:
 * 1. Hapus data lama (FK-safe order) via koneksi langsung port 5432.
 * 2. Buat 6 user, 6 tahun ajaran, 102 class slots (17 kelas × 6 tahun).
 * 3. Batch insert 200 siswa tersebar di semua kelas.
 * 4. Batch insert semua semester records, scores, attendance, dll.
 * 5. Strategi: kumpulkan semua INSERT dalam array, execute batch per tabel.
 * 6. Seed deterministik (seed=42) — hasil konsisten setiap run.
 */

import pg from "pg";

// ── Koneksi Database ──────────────────────────────────────────────────────
const client = new pg.Client({ connectionString: process.env.DATABASE_URL! });
await client.connect();
async function q(sql: string, ...params: any[]) {
  return client.query(sql, params);
}

// ── Data Referensi ────────────────────────────────────────────────────────

const FIRST_NAMES = [
  "Ahmad","Bunga","Cahya","Dwi","Eka","Fajar","Gita","Hendra","Indah","Joko",
  "Kartika","Lukman","Maya","Nanda","Olivia","Putra","Rina","Sigit","Tari","Umar",
  "Vina","Wahyu","Yuni","Zaki","Adi","Bella","Citra","Dimas","Elsa","Farhan",
  "Gilang","Hana","Irfan","Jasmine","Kevin","Laras","Miko","Nadia","Oscar","Prita",
  "Qori","Rafi","Sinta","Teguh","Ulfah","Vicky","Winda","Xaverius","Yoga","Zahra",
  "Agung","Bambang","Cindy","Doni","Euis","Fikri","Galuh","Herman","Intan","Jefri",
];
const LAST_NAMES = [
  "Fauzi","Lestari","Ningsih","Prasetyo","Ayu","Ramadhan","Savitri","Gunawan",
  "Permata","Susilo","Sari","Hakim","Anggraini","Pratama","Dewi","Kusuma",
  "Wijaya","Putri","Santoso","Rahayu","Hidayat","Nur","Setiawan","Utami",
  "Purnama","Wibowo","Hartono","Kurniawan","Saputra","Mulyani","Haryanto",
  "Fitriani","Maulana","Puspita","Nasution","Siregar","Simanjuntak","Wulandari",
  "Handayani","Suryadi","Mardiana","Pangestu","Wardhana","Suherman","Nugroho",
  "Pertiwi","Ardiansyah","Laksmi","Budiman","Suharto",
];
const SUBJECTS = [
  "Pendidikan Agama","Pendidikan Pancasila","Bahasa Indonesia",
  "Matematika","IPA","IPS","Seni Budaya","PJOK",
];
const ACH_AKADEMIK = [
  "Juara Kelas","Olimpiade Matematika","Lomba IPA","Cerdas Cermat",
  "Olimpiade Sains","Kompetisi Bahasa Inggris","Lomba MTK","Festival Sains",
];
const ACH_NONAKADEMIK = [
  "Pramuka","Pidato","Mading","Paduan Suara","Seni Lukis",
  "Olahraga","Taekwondo","Pencak Silat","Menari","Drama",
];

// ── Additional data arrays untuk field baru (FR-04) ──────────────────────────
const STREET_NAMES = [
  "Jl. Merdeka", "Jl. Raya", "Jl. Diponegoro", "Jl. Ahmad Yani", "Jl. Sudirman",
  "Jl. Pattimura", "Jl. Gajah Mada", "Jl. Hayam Wuruk", "Jl. Siliwangi", "Jl. Pahlawan",
  "Jl. Kartini", "Jl. Imam Bonjol", "Jl. Pemuda", "Jl. Veteran", "Jl. Proklamasi",
];
const VILLAGE_NAMES = [
  "Ciporang", "Cikole", "Cibiru", "Cisaladah", "Cijambe",
  "Cibeureum", "Cimahi", "Cilimus", "Ciwaringin", "Cikancung",
  "Ciganitri", "Cilengkrang", "Cisurupan", "Cibodas", "Cikandang",
];
const DISTRICT_NAMES = [
  "Cimahi", "Cicalengka", "Cililin", "Cisalak", "Cisarua",
  "Cimaung", "Ciparay", "Cikancung", "Cileunyi", "Cimenyan",
];

// ── PRNG ──────────────────────────────────────────────────────────────────
let seed = 42;
function rand() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
function ri(min: number, max: number) { return Math.floor(rand() * (max - min + 1)) + min; }
function pick<T>(arr: T[]): T { return arr[Math.floor(rand() * arr.length)]; }

// ── Generators for new Student fields (FR-04) ─────────────────────────────
/** Generate a random birth date between 2012 and 2020 (inclusive) in YYYY-MM-DD format */
function genBirthDate(): string {
  const year = ri(2012, 2020);
  const month = ri(1, 12);
  const maxDay = new Date(year, month, 0).getDate(); // days in month
  const day = ri(1, maxDay);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Generate a realistic Indonesian village-level address */
function genAddress(): string {
  const street = pick(STREET_NAMES);
  const number = ri(1, 120);
  const village = pick(VILLAGE_NAMES);
  const district = pick(DISTRICT_NAMES);
  return `${street} No. ${number}, ${village}, Kec. ${district}`;
}

/** Generate a parent name from first name with Bpk./Ibu. prefix */
function genParentName(gender: string): string {
  const prefix = gender === "L" ? "Bpk." : "Ibu.";
  return `${prefix} ${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
}

// ── Score Generator ───────────────────────────────────────────────────────
function genScores(profile: string, yi: number, sem: number): number[] {
  const p = yi * 2 + sem;
  return SUBJECTS.map((_, i) => {
    const bases: Record<string, number> = {
      top: 78 + p * 1.2 + i * 0.3,
      average: 72 + p * 0.8 + i * 0.2,
      "below-average": 65 + p * 0.4 - i * 0.3,
      "at-risk": 58 + p * 0.3 - i * 0.5,
      inconsistent: 70 + (i % 2 === 0 ? 12 : -6) + (p % 2 === 0 ? 8 : -4),
    };
    const base = bases[profile] ?? 70 + p * 0.6;
    return Math.max(25, Math.min(100, Math.round(base + (rand() - 0.5) * 14)));
  });
}

// ── Profile distribution ──────────────────────────────────────────────────
const PROFILES = [
  "top","top","top",
  "average","average","average","average","average","average","average","average",
  "average","average","average",
  "below-average","below-average","below-average",
  "at-risk","at-risk",
  "inconsistent",
];

// ── UUID Generator (deterministic, uses seed) ─────────────────────────────
function genUUID(): string {
  const hex = "0123456789abcdef";
  const template = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";
  let result = "";
  for (const ch of template) {
    if (ch === "x") result += hex[ri(0, 15)];
    else if (ch === "y") result += hex[(ri(0, 3) | 8)];
    else result += ch;
  }
  return result;
}

// ── Batch Insert Helper ───────────────────────────────────────────────────
/**
 * Executes a batch INSERT with multiple value rows.
 * Columns should NOT include createdAt/updatedAt — they are auto-appended with now().
 * @param table - Table name (with quotes if reserved)
 * @param dataCols - Array of data column names (excludes createdAt/updatedAt)
 * @param rows - Array of value arrays (excludes createdAt/updatedAt values)
 */
async function batchInsert(table: string, dataCols: string[], rows: any[][]) {
  if (rows.length === 0) return;
  const colSql = dataCols.map(c => `"${c}"`).join(",");
  const paramCount = dataCols.length;
  const placeholders = rows.map((_, ri2) =>
    `(${Array.from({ length: paramCount }, (_, ci) => `$${ri2 * paramCount + ci + 1}`).join(",")},now(),now())`
  ).join(",");
  const flatValues = rows.flat();
  await q(
    `INSERT INTO ${table} (${colSql},"createdAt","updatedAt") VALUES ${placeholders}`,
    ...flatValues,
  );
}

// ── Helper values ─────────────────────────────────────────────────────────
const CT = "now(),now()"; // Not directly used — batchInsert adds now() for last 2 cols

// ── MAIN ──────────────────────────────────────────────────────────────────
async function main() {
  const tStart = performance.now();
  console.log("🌱 LSAR Seed v2 — Starting...\n");

  // ═════════════════════════════════════════════════════════════════════
  // 0. CLEAN — via admin connection (port 5432, bypass PgBouncer)
  // ═════════════════════════════════════════════════════════════════════
  const adminClient = new pg.Client({ connectionString: process.env.DATABASE_URL!.replace(':6432/', ':5432/') });
  await adminClient.connect();
  for (const t of ['predicted_outcome','ai_summary','achievement','health_record','attendance','subject_score','semester_record','class_audit_log','teacher_note','student_document','student','class','ml_model','academic_year','"user"']) {
    await adminClient.query(`DELETE FROM ${t}`);
  }
  await adminClient.end();
  console.log("🧹 Database cleaned");

  // ═════════════════════════════════════════════════════════════════════
  // 1. USERS (6 users)
  // ═════════════════════════════════════════════════════════════════════
  const [hAdmin, hGuru] = await Promise.all([
    Bun.password.hash("admin123", { algorithm: "bcrypt", cost: 4 }),
    Bun.password.hash("guru123", { algorithm: "bcrypt", cost: 4 }),
  ]);
  const userData = [
    ["admin", hAdmin, "Administrator", "ADMINISTRATOR"],
    ["operator", hGuru, "Siti Nurhaliza", "OPERATOR_SEKOLAH"],
    ["kepsek", hAdmin, "Drs. H. Suryana, M.Pd.", "KEPALA_SEKOLAH"],
    ["guru1", hGuru, "Ani Rahmawati, S.Pd.", "GURU"],
    ["guru2", hGuru, "Budi Santoso, S.Pd.", "GURU"],
    ["guru3", hGuru, "Citra Dewi, S.Pd.", "GURU"],
  ];
  const userIds: Record<string, string> = {};
  for (const [uname, pw, name, role] of userData) {
    const uid = genUUID();
    userIds[uname as string] = uid;
    await q(
      `INSERT INTO "user" (id,username,password,name,role,"isActive","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5::"Role",true,now(),now())`,
      uid, uname, pw, name, role,
    );
  }
  console.log(`✅ Users (6): ${Object.keys(userIds).join(", ")}`);

  // ═════════════════════════════════════════════════════════════════════
  // 2. ACADEMIC YEARS
  // ═════════════════════════════════════════════════════════════════════
  const yearLabels = ["2020/2021","2021/2022","2022/2023","2023/2024","2024/2025","2025/2026"];
  const yearIds: Record<string, string> = {};
  for (const y of yearLabels) {
    const yid = genUUID();
    yearIds[y] = yid;
    await q(
      `INSERT INTO academic_year (id,year,"isActive","isArchived","createdAt","updatedAt")
       VALUES ($1,$2,$3,NOT $3,now(),now())`,
      yid, y, y === "2025/2026",
    );
  }
  console.log(`✅ Academic Years: ${yearLabels.join(" → ")} (active: 2025/2026)`);

  // ═════════════════════════════════════════════════════════════════════
  // 3. CLASSES (17 × 6 = 102 rows)
  // ═════════════════════════════════════════════════════════════════════
  const gradeClasses: Array<{ grade: number; names: string[] }> = [
    { grade: 1, names: ["1A","1B"] },
    { grade: 2, names: ["2A","2B","2C"] },
    { grade: 3, names: ["3A","3B","3C"] },
    { grade: 4, names: ["4A","4B","4C"] },
    { grade: 5, names: ["5A","5B","5C"] },
    { grade: 6, names: ["6A","6B","6C"] },
  ];
  const classIds: Record<string, string> = {}; // key: "{name}-{year}"
  const classRows: any[][] = [];

  for (const { names } of gradeClasses) {
    for (const cn of names) {
      for (const y of yearLabels) {
        const cid = genUUID();
        classIds[`${cn}-${y}`] = cid;
        classRows.push([cid, cn, yearIds[y], userIds.guru1]);
      }
    }
  }
  // Distribute homeroom teachers — per kelas per tahun (fix: tiap kelas dpt guru berbeda tiap tahun)
  const teacherCycle = [userIds.guru1, userIds.guru2, userIds.guru3];
  let classIdx = 0;
  for (const { names } of gradeClasses) {
    for (let ni = 0; ni < names.length; ni++) {
      for (let yi = 0; yi < yearLabels.length; yi++) {
        // ni = index nama dalam grade, yi = index tahun → rotasi guru
        classRows[classIdx][3] = teacherCycle[(ni + yi) % 3];
        classIdx++;
      }
    }
  }
  await batchInsert("class", ["id","name","academicYearId","homeroomTeacherId"], classRows);
  console.log(`✅ Classes: ${classRows.length} (${gradeClasses.map(g => `${g.grade}(${g.names.length})`).join(", ")}) × 6 years`);

  // Current year class IDs
  const currentClassIds: Record<string, string> = {};
  for (const { names } of gradeClasses) {
    for (const cn of names) {
      currentClassIds[cn] = classIds[`${cn}-2025/2026`];
    }
  }

  // ═════════════════════════════════════════════════════════════════════
  // 4. STUDENTS + SEMESTER RECORDS + SCORES + ATTENDANCE (batch)
  // ═════════════════════════════════════════════════════════════════════
  const studentDistribution = [
    { grade: 1, perClass: 16, names: ["1A","1B"], startYear: 5 },
    { grade: 2, perClass: 14, names: ["2A","2B","2C"], startYear: 4 },
    { grade: 3, perClass: 12, names: ["3A","3B","3C"], startYear: 3 },
    { grade: 4, perClass: 12, names: ["4A","4B","4C"], startYear: 2 },
    { grade: 5, perClass: 10, names: ["5A","5B","5C"], startYear: 1 },
    { grade: 6, perClass: 8,  names: ["6A","6B","6C"], startYear: 0 },
  ];

  // Batch arrays
  const studentBatch: any[][] = [];
  const semesterBatch: any[][] = [];
  const scoreBatch: any[][] = [];
  const attendanceBatch: any[][] = [];
  const healthBatch: any[][] = [];
  const achievementBatch: any[][] = [];
  const noteBatch: any[][] = [];

  // Teacher notes templates
  const NOTE_TEMPLATES = [
    "Siswa ini perlu perhatian khusus dalam mata pelajaran Matematika dan IPA. Disarankan bimbingan tambahan.",
    "Perkembangan akademik siswa menunjukkan peningkatan yang signifikan dibanding semester sebelumnya.",
    "Siswa aktif dalam kegiatan ekstrakurikuler dan menunjukkan bakat kepemimpinan yang baik.",
    "Kehadiran siswa perlu ditingkatkan. Orang tua sudah dihubungi untuk membahas masalah ini.",
    "Siswa memiliki potensi besar di bidang seni dan olahraga. Prestasi non-akademik sangat membanggakan.",
    "Kedisiplinan dan tanggung jawab siswa dalam mengerjakan tugas perlu ditingkatkan.",
    "Siswa menunjukkan minat tinggi dalam pelajaran IPA dan Matematika. Disarankan mengikuti olimpiade.",
    "Perlu perhatian khusus dalam hal sosialisasi dengan teman sekelas. Disarankan bimbingan konseling.",
    "Nilai siswa stabil dan menunjukkan konsistensi yang baik di semua mata pelajaran.",
    "Siswa mengalami penurunan motivasi belajar. Perlu pendekatan khusus dan dukungan moral.",
  ];

  let studentCounter = 0;

  for (const { grade, perClass, names, startYear } of studentDistribution) {
    for (const cn of names) {
      const clsId = currentClassIds[cn];
      if (!clsId) continue;

      for (let si = 0; si < perClass; si++) {
        // Student identity
        const name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
        const gender = rand() > 0.5 ? "L" : "P";
        const profile = PROFILES[studentCounter % PROFILES.length];
        const nis = 200000 + studentCounter + 1;
        const nisn = 10000000 + studentCounter + 1;
        const sId = genUUID();
        studentCounter++;

        // Generate optional fields (FR-04)
        const birthDate = genBirthDate();            // Tanggal lahir antara 2012-2020
        const address = genAddress();                // Alamat desa/kelurahan di Indonesia
        const parentName = genParentName(gender);     // Nama orang tua sesuai gender

        studentBatch.push([sId, String(nis), String(nisn), name, gender, clsId, birthDate, address, parentName]);

        // Semester records
        for (let yi = startYear; yi < 6; yi++) {
          const yrLabel = yearLabels[yi];
          const yrId = yearIds[yrLabel];
          const scores = genScores(profile, yi, 1); // sem 1
          const scores2 = genScores(profile, yi, 2); // sem 2

          for (let sem = 1; sem <= 2; sem++) {
            const semScores = sem === 1 ? scores : scores2;
            const recId = genUUID();
            semesterBatch.push([recId, sId, yrId, sem, userIds.guru1]);

            // 8 subject scores
            for (let si2 = 0; si2 < SUBJECTS.length; si2++) {
              const knowledge = semScores[si2];
              const skills = Math.max(25, Math.min(100, knowledge - ri(1, 5)));
              scoreBatch.push([genUUID(), recId, SUBJECTS[si2], knowledge, skills, null]);
            }

            // Attendance
            const [sk, pm, ab] = (() => {
              switch (profile) {
                case "top":           return [ri(0, 1), 0, 0];
                case "at-risk":       return [ri(1, 5), ri(0, 4), ri(1, 6)];
                case "inconsistent":  return [ri(0, 3), ri(0, 2), ri(0, 4)];
                case "below-average": return [ri(0, 3), ri(0, 2), ri(0, 3)];
                default:              return [ri(0, 2), ri(0, 1), ri(0, 2)];
              }
            })();
            attendanceBatch.push([genUUID(), recId, sk, pm, ab]);

            // Health record — sem 1 only
            if (sem === 1) {
              healthBatch.push([
                genUUID(), recId,
                ri(105, 165), ri(16, 55),
                rand() > 0.95 ? "Gangguan" : "Normal",
                rand() > 0.88 ? "Gangguan" : "Normal",
                rand() > 0.85 ? "Karies" : "Normal",
              ]);
            }

            // Achievement — sem 2, upper grades, top/inconsistent
            if (sem === 2 && yi >= 3 && (profile === "top" || profile === "inconsistent") && rand() > 0.55) {
              const isAka = rand() > 0.4;
              achievementBatch.push([
                genUUID(), recId,
                pick(isAka ? ACH_AKADEMIK : ACH_NONAKADEMIK),
                isAka ? "Akademik" : "Non-Akademik",
                null, null,
              ]);
            }
          }
        }

        // Teacher notes — for eligible students
        if (profile === "at-risk" || profile === "inconsistent" || profile === "top") {
          const noteCount = ri(1, 3);
          const used = new Set<number>();
          for (let ni = 0; ni < noteCount; ni++) {
            let idx: number;
            do { idx = ri(0, NOTE_TEMPLATES.length - 1); } while (used.has(idx));
            used.add(idx);
            const teacherId = pick([userIds.guru1, userIds.guru2, userIds.guru3]);
            noteBatch.push([genUUID(), sId, teacherId, NOTE_TEMPLATES[idx]]);
          }
        }
      }
    }
    console.log(`  Grade ${grade}: processed`);
  }

  // ── Execute all batch inserts ─────────────────────────────────────────
  console.log("\n📦 Batch inserting data...");

  // Helper: chunk by max params (500 per batch to stay under PgBouncer limits)
  async function batchChunks(table: string, columns: string[], rows: any[][], chunkSize = 60) {
    for (let i = 0; i < rows.length; i += chunkSize) {
      await batchInsert(table, columns, rows.slice(i, i + chunkSize));
    }
  }

  // Students (including FR-04 fields: birthDate, address, parentName)
  await batchChunks("student", ["id","nis","nisn","name","gender","classId","birthDate","address","parentName"], studentBatch, 40);
  console.log(`  ✅ ${studentBatch.length} students`);

  // Semester records
  await batchChunks("semester_record", ["id","studentId","academicYearId","semester","createdById"], semesterBatch, 60);
  console.log(`  ✅ ${semesterBatch.length} semester records`);

  // Subject scores
  await batchChunks("subject_score", ["id","semesterRecordId","subjectName","knowledgeScore","skillsScore","notes"], scoreBatch, 50);
  console.log(`  ✅ ${scoreBatch.length} subject scores`);

  // Attendance
  await batchChunks("attendance", ["id","semesterRecordId","sick","permission","absent"], attendanceBatch, 60);
  console.log(`  ✅ ${attendanceBatch.length} attendance records`);

  // Health
  await batchChunks("health_record", ["id","semesterRecordId","height","weight","hearingCondition","visionCondition","teethCondition"], healthBatch, 50);
  console.log(`  ✅ ${healthBatch.length} health records`);

  // Achievements
  await batchChunks("achievement", ["id","semesterRecordId","title","type","description","attachmentUrl"], achievementBatch, 50);
  console.log(`  ✅ ${achievementBatch.length} achievements`);

  // Teacher notes
  await batchChunks("teacher_note", ["id","studentId","createdById","content"], noteBatch, 60);
  console.log(`  ✅ ${noteBatch.length} teacher notes`);

  // ═════════════════════════════════════════════════════════════════════
  // 5. ML MODELS
  // ═════════════════════════════════════════════════════════════════════
  for (const model of [
    ["Risk v1", "RISK_CLASSIFICATION", '{"f1":0.82}', '["avgKnowledge","scoreVolatility","scoreDelta","totalAbsence","achievementCount"]'],
    ["Trend v1", "TREND_PREDICTION", '{"r2":0.72}', '["semesterCount","avgKnowledge","scoreDelta"]'],
    ["Cluster v1", "BEHAVIOR_CLUSTER", '{"clusters":3}', '["avgKnowledge","avgSkills","totalAbsence","achievementCount"]'],
  ]) {
    await q(
      `INSERT INTO ml_model (id,name,"modelType",version,metrics,"featureList","isActive","trainedAt","createdAt","updatedAt")
       VALUES ($1,$2,$3::"ModelType",1,$4::jsonb,$5::jsonb,true,now(),now(),now())`,
      genUUID(), model[0], model[1], model[2], model[3],
    );
  }
  console.log("  ✅ 3 ML models");

  // ═════════════════════════════════════════════════════════════════════
  // 6. SUMMARY
  // ═════════════════════════════════════════════════════════════════════
  const elapsed = ((performance.now() - tStart) / 1000).toFixed(1);
  console.log(`\n╔══════════════════════════════════════════════════════════╗`);
  console.log(`║  🎯 Seed completed in ${elapsed}s                          ║`);
  console.log(`╠══════════════════════════════════════════════════════════╣`);
  console.log(`║  admin    │ admin123  │ ADMINISTRATOR                    ║`);
  console.log(`║  operator │ guru123   │ OPERATOR_SEKOLAH                 ║`);
  console.log(`║  kepsek   │ admin123  │ KEPALA_SEKOLAH                   ║`);
  console.log(`║  guru1    │ guru123   │ GURU (Kelas 1A,2A,3A,4A,5A,6A)  ║`);
  console.log(`║  guru2    │ guru123   │ GURU (Kelas 1B,2B,3B,4B,5B,6B)  ║`);
  console.log(`║  guru3    │ guru123   │ GURU (Kelas 2C,3C,4C,5C,6C)     ║`);
  console.log(`╠══════════════════════════════════════════════════════════╣`);
  console.log(`║  ${String(studentBatch.length).padStart(4)} students                                    ║`);
  console.log(`║  ${String(semesterBatch.length).padStart(5)} semester records                            ║`);
  console.log(`║  ${String(scoreBatch.length).padStart(6)} subject scores                               ║`);
  console.log(`║  ${String(attendanceBatch.length).padStart(5)} attendance records                          ║`);
  console.log(`║  ${String(healthBatch.length).padStart(5)} health records                               ║`);
  console.log(`║  ${String(achievementBatch.length).padStart(4)} achievements                              ║`);
  console.log(`║  ${String(noteBatch.length).padStart(4)} teacher notes                               ║`);
  console.log(`╚══════════════════════════════════════════════════════════╝`);

  await client.end();
}

main().catch((e) => {
  console.error("\n❌ SEED FAILED:", e.message?.substring(0, 500));
  process.exit(1);
});
