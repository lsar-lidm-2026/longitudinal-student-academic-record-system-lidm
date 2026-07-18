/**
 * LSAR Seed — Sekolah Dasar (6 years, Kelas 1 → 6).
 * Uses Prisma ORM (not raw pg) — confirmed working.
 */

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter }) as PrismaClient;

const FIRST = ["Ahmad","Bunga","Cahya","Dwi","Eka","Fajar","Gita","Hendra","Indah","Joko","Kartika","Lukman","Maya","Nanda","Olivia","Putra","Rina","Sigit","Tari","Umar"];
const LAST = ["Fauzi","Lestari","Ningsih","Prasetyo","Ayu","Ramadhan","Savitri","Gunawan","Permata","Susilo","Sari","Hakim","Anggraini","Pratama","Dewi"];
const SUBJECTS = ["Pendidikan Agama","Pendidikan Pancasila","Bahasa Indonesia","Matematika","IPA","IPS","Seni Budaya","PJOK"];

const _seed = { v: 42, next() { this.v = (this.v * 16807) % 2147483647; return (this.v - 1) / 2147483646; } };
const rand = () => _seed.next();
const randInt = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];

async function hash(pw: string) {
  return await Bun.password.hash(pw, { algorithm: "bcrypt", cost: 4 });
}

/** Generate realistic scores progressing across 6 years of SD */
function genScores(profile: string, yearIdx: number, semester: number): number[] {
  const progress = yearIdx * 2 + semester;
  return SUBJECTS.map((_, i) => {
    let base: number;
    switch (profile) {
      case "top": base = 78 + progress * 1.2 + i * 0.3; break;
      case "at-risk": base = 62 + progress * 0.5 - i * 0.5; break;
      case "inconsistent": base = 70 + (i % 2 === 0 ? 12 : -6) + (progress % 2 === 0 ? 8 : -4); break;
      default: base = 72 + progress * 0.8 + i * 0.2; break;
    }
    return Math.max(35, Math.min(100, Math.round(base + (rand() - 0.5) * 10)));
  });
}

async function main() {
  const [admin, op, kepsek, g1, g2, g3] = await Promise.all([
    prisma.user.create({ data: { username: "admin", password: await hash("admin123"), name: "Administrator", role: "ADMINISTRATOR" } }),
    prisma.user.create({ data: { username: "operator", password: await hash("guru123"), name: "Operator Sekolah", role: "OPERATOR_SEKOLAH" } }),
    prisma.user.create({ data: { username: "kepsek", password: await hash("admin123"), name: "Drs. H. Suryana, M.Pd.", role: "KEPALA_SEKOLAH" } }),
    prisma.user.create({ data: { username: "guru1", password: await hash("guru123"), name: "Ani Rahmawati, S.Pd.", role: "GURU" } }),
    prisma.user.create({ data: { username: "guru2", password: await hash("guru123"), name: "Budi Santoso, S.Pd.", role: "GURU" } }),
    prisma.user.create({ data: { username: "guru3", password: await hash("guru123"), name: "Citra Dewi, S.Pd.", role: "GURU" } }),
  ]);
  console.log("✅ Users (6)");

  // ── Create 6 academic years ──────────────────────────────────────
  const years = [
    await prisma.academicYear.create({ data: { year: "2020/2021", isActive: false, isArchived: true } }),
    await prisma.academicYear.create({ data: { year: "2021/2022", isActive: false, isArchived: true } }),
    await prisma.academicYear.create({ data: { year: "2022/2023", isActive: false, isArchived: true } }),
    await prisma.academicYear.create({ data: { year: "2023/2024", isActive: false, isArchived: true } }),
    await prisma.academicYear.create({ data: { year: "2024/2025", isActive: false, isArchived: false } }),
    await prisma.academicYear.create({ data: { year: "2025/2026", isActive: true, isArchived: false } }),
  ];
  const [y1, y2, y3, y4, y5, y6] = years;
  console.log("✅ Academic Years (2020/2021 → 2025/2026)");

  // ── Create classes (Kelas 1 → 6) ─────────────────────────────────
  const classDefs = [
    { year: y1, names: ["1A", "1B"],         teachers: [g1, g2] },
    { year: y2, names: ["2A", "2B", "2C"],   teachers: [g1, g2, g3] },
    { year: y3, names: ["3A", "3B", "3C"],   teachers: [g1, g2, g3] },
    { year: y4, names: ["4A", "4B", "4C"],   teachers: [g1, g2, g3] },
    { year: y5, names: ["5A", "5B", "5C"],   teachers: [g1, g2, g3] },
    { year: y6, names: ["6A", "6B", "6C"],   teachers: [g1, g2, g3] },
  ];
  const allClasses: any[] = [];
  for (const cd of classDefs) {
    for (let i = 0; i < cd.names.length; i++) {
      allClasses.push(await prisma.class.create({
        data: { name: cd.names[i], academicYearId: cd.year.id, homeroomTeacherId: cd.teachers[i].id },
      }));
    }
  }
  console.log(`✅ Classes (${allClasses.length})`);

  // ── Students ─────────────────────────────────────────────────────
  const N = 24; // 8 per class (6A, 6B, 6C)
  const profilePool = ["top","top","average","average","average","average","average","average","average","at-risk","at-risk","inconsistent"];

  for (let si = 0; si < N; si++) {
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    const gender = rand() > 0.5 ? "L" : "P";
    const profile = profilePool[si % profilePool.length];
    const classGroup = si < 8 ? 0 : si < 16 ? 1 : 2;
    const currentClass = allClasses[14 + classGroup]; // classes[14]=6A, [15]=6B, [16]=6C

    const student = await prisma.student.create({
      data: { nis: String(100001 + si), nisn: String(200001 + si), name, gender, classId: currentClass.id },
    });

    // 12 semesters across 6 years
    for (let yearIdx = 0; yearIdx < 6; yearIdx++) {
      for (let sem = 0; sem < 2; sem++) {
        const semester = sem + 1;
        const scores = genScores(profile, yearIdx, semester);

        const record = await prisma.semesterRecord.create({
          data: {
            studentId: student.id,
            academicYearId: years[yearIdx].id,
            semester,
            createdById: g1.id,
          },
        });

        // Create subject scores
        for (let si2 = 0; si2 < SUBJECTS.length; si2++) {
          await prisma.subjectScore.create({
            data: {
              semesterRecordId: record.id,
              subjectName: SUBJECTS[si2],
              knowledgeScore: scores[si2],
              skillsScore: Math.max(25, scores[si2] - randInt(1, 4)),
            },
          });
        }

        // Attendance
        const attData = (() => {
          switch (profile) {
            case "top": return { sick: randInt(0,1), permission: 0, absent: 0 };
            case "at-risk": return { sick: randInt(1,4), permission: randInt(0,3), absent: randInt(1,5) };
            case "inconsistent": return { sick: randInt(0,3), permission: randInt(0,2), absent: randInt(0,3) };
            default: return { sick: randInt(0,3), permission: randInt(0,1), absent: randInt(0,2) };
          }
        })();
        await prisma.attendance.create({ data: { semesterRecordId: record.id, ...attData } });

        // Achievements (later years, top/inconsistent)
        if ((profile === "top" || profile === "inconsistent") && yearIdx >= 3 && sem === 1 && rand() > 0.5) {
          await prisma.achievement.create({
            data: {
              semesterRecordId: record.id,
              title: pick(["Juara Kelas","Olimpiade MTK","Lomba IPA","Pramuka","Pidato"]),
              type: rand() > 0.5 ? "Akademik" : "Non-Akademik",
            },
          });
        }

        // Health record (every semester 1)
        if (sem === 1) {
          await prisma.healthRecord.create({
            data: {
              semesterRecordId: record.id,
              height: randInt(110, 155),
              weight: randInt(18, 45),
              hearingCondition: "Normal",
              visionCondition: rand() > 0.9 ? "Menggunakan kacamata" : "Normal",
              teethCondition: "Normal",
            },
          });
        }
      }
    }

    if ((si + 1) % 6 === 0) process.stdout.write(`  ${si + 1}/${N}\n`);
  }
  console.log(`✅ ${N} students × 12 semesters × ${SUBJECTS.length} subjects`);

  // ── ML Models ──────────────────────────────────────────────────────
  await prisma.mlModel.createMany({
    data: [
      { name: "Risk v1", modelType: "RISK_CLASSIFICATION", version: 1, metrics: { f1: 0.82 }, featureList: ["avgKnowledge","scoreVolatility","scoreDelta","totalAbsence","achievementCount"], isActive: true, trainedAt: new Date() },
      { name: "Trend v1", modelType: "TREND_PREDICTION", version: 1, metrics: { r2: 0.72 }, featureList: ["semesterCount","avgKnowledge","scoreDelta"], isActive: true, trainedAt: new Date() },
      { name: "Cluster v1", modelType: "BEHAVIOR_CLUSTER", version: 1, metrics: { clusters: 3 }, featureList: ["avgKnowledge","avgSkills","totalAbsence","achievementCount"], isActive: true, trainedAt: new Date() },
    ],
  });
  console.log("✅ ML Models (3)");

  console.log("\n╔═══════════════════════════════════════╗");
  console.log("║ admin   │ admin123  │ ADMINISTRATOR  ║");
  console.log("║ guru1   │ guru123   │ GURU           ║");
  console.log("║ kepsek  │ admin123  │ KEPALA_SEKOLAH ║");
  console.log("╚═══════════════════════════════════════╝");
  console.log(`\n🎯 ${N} siswa × 6 tahun (Kelas 1-6), ${N * 12} semester records`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error("\nFAIL:", e.message?.substring(0, 500)); process.exit(1); });
