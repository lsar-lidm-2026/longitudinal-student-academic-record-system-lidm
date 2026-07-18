/**
 * LSAR Seed — Full SD (Kelas 1 → 6), 24 students × 12 semesters.
 * Uses pg.Pool directly (confirmed to work with this DB).
 */

import pg from "pg";

// Use a direct client (not pool) to avoid deadlock issues
// Use DATABASE_URL (through PgBouncer on 6432 — fine for single-connection CRUD)
const client = new pg.Client({ connectionString: process.env.DATABASE_URL! });
await client.connect();
async function q(sql: string, ...params: any[]) {
  return client.query(sql, params);
}

const FIRST = ["Ahmad","Bunga","Cahya","Dwi","Eka","Fajar","Gita","Hendra","Indah","Joko","Kartika","Lukman","Maya","Nanda","Olivia","Putra","Rina","Sigit","Tari","Umar","Vina","Wahyu","Yuni","Zaki"];
const LAST = ["Fauzi","Lestari","Ningsih","Prasetyo","Ayu","Ramadhan","Savitri","Gunawan","Permata","Susilo","Sari","Hakim","Anggraini","Pratama","Dewi","Kusuma","Wijaya","Putri","Santoso","Rahayu","Hidayat","Nur","Setiawan","Utami"];
const SUBJ = ["Pendidikan Agama","Pendidikan Pancasila","Bahasa Indonesia","Matematika","IPA","IPS","Seni Budaya","PJOK"];

let seed = 42;
function rand() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
function ri(min: number, max: number) { return Math.floor(rand() * (max - min + 1)) + min; }
function pick<T>(arr: T[]): T { return arr[Math.floor(rand() * arr.length)]; }

function genScores(profile: string, yi: number, sem: number): number[] {
  const p = yi * 2 + sem;
  return SUBJ.map((_, i) => {
    const b: Record<string, number> = { top: 78 + p*1.2 + i*0.3, "at-risk": 62 + p*0.5 - i*0.5, inconsistent: 70 + (i%2===0?12:-6) + (p%2===0?8:-4) };
    const base = b[profile] ?? 72 + p*0.8 + i*0.2;
    return Math.max(35, Math.min(100, Math.round(base + (rand() - 0.5) * 10)));
  });
}

const CTU = '"createdAt","updatedAt"';

async function main() {
  // ── Clean + confirm connection works ──────────────────────────────
  // Connect to port 5432 directly (bypass PgBouncer) for TRUNCATE
  const adminClient = new pg.Client({ connectionString: process.env.DATABASE_URL!.replace(':6432/', ':5432/') });
  await adminClient.connect();
  await adminClient.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=current_database() AND pid <> pg_backend_pid()");
  // Delete in FK-safe order (leaf tables first)
  for (const t of ['predicted_outcome','ai_summary','achievement','health_record','attendance','subject_score','semester_record','class_audit_log','student','class','ml_model','academic_year','"user"'])
    await adminClient.query(`DELETE FROM ${t}`);
  console.log("🧹 DB ready");
  await adminClient.end();

  // ── Users ──────────────────────────────────────────────────────────
  const [ha, hg] = await Promise.all([Bun.password.hash("admin123", {algorithm:"bcrypt",cost:4}), Bun.password.hash("guru123", {algorithm:"bcrypt",cost:4})]);
  await q(`INSERT INTO "user" (id,username,password,name,role,"isActive",${CTU}) VALUES
    (gen_random_uuid(),'admin',$1,'Administrator','ADMINISTRATOR',true,now(),now()),
    (gen_random_uuid(),'operator',$2,'Operator','OPERATOR_SEKOLAH',true,now(),now()),
    (gen_random_uuid(),'kepsek',$1,'Drs. H. Suryana','KEPALA_SEKOLAH',true,now(),now()),
    (gen_random_uuid(),'guru1',$2,'Ani Rahmawati','GURU',true,now(),now()),
    (gen_random_uuid(),'guru2',$2,'Budi Santoso','GURU',true,now(),now()),
    (gen_random_uuid(),'guru3',$2,'Citra Dewi','GURU',true,now(),now())`, ha, hg);
  // Verify
  const uR = await q(`SELECT username FROM "user" ORDER BY username`);
  console.log(`✅ Users (${uR.rowCount}: ${uR.rows.map((r:any) => r.username).join(", ")})`);

  // ── Academic Years ──────────────────────────────────────────────────
  const yearLabels = ["2020/2021","2021/2022","2022/2023","2023/2024","2024/2025","2025/2026"];
  for (const y of yearLabels) {
    await q(`INSERT INTO academic_year (id,year,"isActive","isArchived",${CTU}) VALUES (gen_random_uuid(),$1,false,true,now(),now())`, y);
  }
  // Activate 2025/2026
  await q(`UPDATE academic_year SET "isActive"=true,"isArchived"=false WHERE year='2025/2026'`);
  const yR = await q(`SELECT year FROM academic_year ORDER BY year`);
  console.log(`✅ Academic Years (${yR.rowCount}: ${yR.rows.map((r:any)=>r.year).join(" → ")})`);

  // ── Classes ────────────────────────────────────────────────────────
  const grades = [
    ["1A","1B"], ["2A","2B","2C"], ["3A","3B","3C"],
    ["4A","4B","4C"], ["5A","5B","5C"], ["6A","6B","6C"],
  ];
  const gurus = ["guru1","guru2","guru3"];
  for (let gi = 0; gi < 6; gi++) {
    const yr = yearLabels[gi];
    for (let si = 0; si < grades[gi].length; si++) {
      const teach = gurus[Math.min(si, 2)];
      await q(`INSERT INTO class (id,name,"academicYearId","homeroomTeacherId",${CTU})
        SELECT gen_random_uuid(),$1,ay.id,u.id,now(),now() FROM academic_year ay, "user" u
        WHERE ay.year=$2 AND u.username=$3`, grades[gi][si], yr, teach);
    }
  }
  const cR = await q(`SELECT c.name,ay.year FROM class c JOIN academic_year ay ON ay.id=c."academicYearId" ORDER BY ay.year,c.name`);
  console.log(`✅ Classes (${cR.rowCount}: ${cR.rows.map((r:any)=>`${r.name}(${r.year})`).join(" ")})`);

  // ── Pre-fetch all IDs ──────────────────────────────────────────────
  const yearIds: string[] = [];
  for (const y of yearLabels) {
    yearIds.push((await q(`SELECT id FROM academic_year WHERE year=$1`, y)).rows[0]?.id);
  }
  const guru1Id = (await q(`SELECT id FROM "user" WHERE username='guru1'`)).rows[0]?.id;
  // Pre-fetch class IDs for 2025/2026
  const ay6Id = yearIds[5];
  const classIds: Record<string, string> = {};
  for (const c of ["6A","6B","6C"]) {
    const r = await q(`SELECT id FROM class WHERE name=$1 AND "academicYearId"=$2`, c, ay6Id);
    classIds[c] = r.rows[0]?.id;
  }
  console.log(`  yearIds: ${yearIds.length}, ay6Id: ${ay6Id?.substring(0,8)}..., classIds: ${Object.keys(classIds).length}`);

  // ── Students ───────────────────────────────────────────────────────
  const N = 24;
  const PROFILES = ["top","top","average","average","average","average","average","average","average","at-risk","at-risk","inconsistent"];

  for (let si = 0; si < N; si++) {
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    const gender = rand() > 0.5 ? "L" : "P";
    const profile = PROFILES[si % PROFILES.length];
    const grp = si < 8 ? 0 : si < 16 ? 1 : 2;
    const cn = `6${"ABC"[grp]}`;

    // Create student
    const clsId = classIds[cn];
    if (!clsId) throw new Error(`Class ${cn} not found in pre-fetched IDs`);
    const rS = await q(`INSERT INTO student (id,nis,nisn,name,gender,"classId",${CTU})
      VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,now(),now()) RETURNING id`,
      String(100001+si), String(200001+si), name, gender, clsId);
    if (rS.rowCount === 0) throw new Error(`Student insert returned 0 rows for ${name}`);
    const sID = rS.rows[0].id;
    // Verify student exists
    const checkS = await q(`SELECT id FROM student WHERE id=$1`, sID);
    if (checkS.rowCount === 0) throw new Error(`Student ${sID} not queryable after insert!`);

    // 12 semesters
    for (let yi = 0; yi < 6; yi++) {
      for (let sem = 0; sem < 2; sem++) {
        const scores = genScores(profile, yi, sem+1);

        // semester_record
        const rSRec = await q(`INSERT INTO semester_record (id,"studentId","academicYearId",semester,"createdById",${CTU})
          VALUES (gen_random_uuid(),$1,$2,$3,$4,now(),now()) RETURNING id`,
          sID, yearIds[yi], sem+1, guru1Id);
        if (rSRec.rowCount === 0) throw new Error(`semester record insert returned 0 rows`);
        const rID = rSRec.rows[0].id;

        // Verify rID is valid
        if (si === 0 && yi === 0 && sem === 0) {
          const checkSem = await q(`SELECT id FROM semester_record WHERE id=$1`, rID);
          console.log(`DEBUG: semrecord exists=${checkSem.rowCount} rID=${rID.substring(0,8)}... sID=${sID.substring(0,8)}... yearId=${yearIds[yi]?.substring(0,8)}`);
        }

        // 8 subject scores — batch INSERT via parameterized query
        for (let si2 = 0; si2 < SUBJ.length; si2++) {
          const ks = scores[si2];
          const ss = Math.max(25, ks - ri(1, 4));
          await q(`INSERT INTO subject_score (id,"semesterRecordId","subjectName","knowledgeScore","skillsScore",${CTU})
            VALUES (gen_random_uuid(),$1,$2,$3,$4,now(),now())`, rID, SUBJ[si2], ks, ss);
        }

        // attendance
        const [sk, pm, ab] = (() => {
          switch (profile) {
            case "top": return [ri(0,1),0,0];
            case "at-risk": return [ri(1,4),ri(0,3),ri(1,5)];
            case "inconsistent": return [ri(0,3),ri(0,2),ri(0,3)];
            default: return [ri(0,3),ri(0,1),ri(0,2)];
          }
        })();
        await q(`INSERT INTO attendance (id,"semesterRecordId",sick,permission,absent,${CTU}) VALUES (gen_random_uuid(),'${rID}',${sk},${pm},${ab},now(),now())`);

        // achievement (later years, top/inconsistent)
        if ((profile === "top" || profile === "inconsistent") && yi >= 3 && sem === 0 && rand() > 0.5) {
          const t = pick(["Juara Kelas","Olimpiade MTK","Lomba IPA","Pramuka","Pidato"]);
          await q(`INSERT INTO achievement (id,"semesterRecordId",title,type,${CTU}) VALUES (gen_random_uuid(),'${rID}','${t}','${rand() > 0.6 ? "Akademik" : "Non-Akademik"}',now(),now())`);
        }

        // health record (sem 1 each year)
        if (sem === 0) {
          await q(`INSERT INTO health_record (id,"semesterRecordId",height,weight,"hearingCondition","visionCondition","teethCondition",${CTU})
            VALUES (gen_random_uuid(),'${rID}',${ri(110,155)},${ri(18,45)},'Normal','${rand() > 0.9 ? "Kacamata" : "Normal"}','Normal',now(),now())`);
        }
      }
    }

    if ((si+1) % 6 === 0) process.stdout.write(`  ${si+1}/${N}\n`);
  }
  console.log(`✅ ${N} students × 12 semesters × ${SUBJ.length} subjects`);

  // ── ML Models ──────────────────────────────────────────────────────
  await q(`INSERT INTO ml_model (id,name,"modelType",version,metrics,"featureList","isActive","trainedAt",${CTU}) VALUES
    (gen_random_uuid(),'Risk v1','RISK_CLASSIFICATION',1,'{"f1":0.82}'::jsonb,'["avgKnowledge","scoreVolatility","scoreDelta","totalAbsence","achievementCount"]'::jsonb,true,now(),now(),now()),
    (gen_random_uuid(),'Trend v1','TREND_PREDICTION',1,'{"r2":0.72}'::jsonb,'["semesterCount","avgKnowledge","scoreDelta"]'::jsonb,true,now(),now(),now()),
    (gen_random_uuid(),'Cluster v1','BEHAVIOR_CLUSTER',1,'{"clusters":3}'::jsonb,'["avgKnowledge","avgSkills","totalAbsence","achievementCount"]'::jsonb,true,now(),now(),now())`);
  console.log("✅ ML Models (3)");

  console.log("\n╔═══════════════════════════════════════╗");
  console.log("║ admin   │ admin123  │ ADMINISTRATOR  ║");
  console.log("║ guru1   │ guru123   │ GURU           ║");
  console.log("║ operator│ guru123   │ OPERATOR       ║");
  console.log("║ kepsek  │ admin123  │ KEPALA_SEKOLAH ║");
  console.log("╚═══════════════════════════════════════╝");
  console.log(`\n🎯 ${N} siswa × 6 tahun SD (Kelas 1 → 6), ${N * 12} semester records`);

  await client.end();
}

main().catch((e) => { console.error("\nFAIL:", e.message?.substring(0, 500)); process.exit(1); });
