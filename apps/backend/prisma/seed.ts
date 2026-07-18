import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter }) as PrismaClient;

const SUBJECTS = [
  "Pendidikan Agama", "Pendidikan Pancasila", "Bahasa Indonesia",
  "Matematika", "IPA", "IPS", "Seni Budaya", "PJOK",
];

async function main() {
  console.log("🌱 Seeding database dengan skenario lengkap...\n");

  // ── USERS ───────────────────────────────────────────────────────────
  const admin = await prisma.user.create({
    data: {
      username: "admin",
      password: await Bun.password.hash("admin123", { algorithm: "bcrypt", cost: 10 }),
      name: "Administrator",
      role: "ADMINISTRATOR",
    },
  });

  const operator = await prisma.user.create({
    data: {
      username: "operator",
      password: await Bun.password.hash("operator123", { algorithm: "bcrypt", cost: 10 }),
      name: "Operator Sekolah",
      role: "OPERATOR_SEKOLAH",
    },
  });

  const guru1 = await prisma.user.create({
    data: {
      username: "guru1",
      password: await Bun.password.hash("guru123", { algorithm: "bcrypt", cost: 10 }),
      name: "Ani Rahmawati, S.Pd.",
      role: "GURU",
    },
  });

  const guru2 = await prisma.user.create({
    data: {
      username: "guru2",
      password: await Bun.password.hash("guru123", { algorithm: "bcrypt", cost: 10 }),
      name: "Budi Santoso, S.Pd.",
      role: "GURU",
    },
  });

  const guru3 = await prisma.user.create({
    data: {
      username: "guru3",
      password: await Bun.password.hash("guru123", { algorithm: "bcrypt", cost: 10 }),
      name: "Citra Dewi, S.Pd.",
      role: "GURU",
    },
  });

  const kepsek = await prisma.user.create({
    data: {
      username: "kepsek",
      password: await Bun.password.hash("kepsek123", { algorithm: "bcrypt", cost: 10 }),
      name: "Drs. H. Suryana, M.Pd.",
      role: "KEPALA_SEKOLAH",
    },
  });

  const users = { admin, operator, guru1, guru2, guru3, kepsek };
  console.log(`✅ Users: ${Object.keys(users).join(", ")}`);

  // ── ACADEMIC YEARS ───────────────────────────────────────────────────
  const year2324 = await prisma.academicYear.create({
    data: { year: "2023/2024", isActive: false, isArchived: true },
  });
  const year2425 = await prisma.academicYear.create({
    data: { year: "2024/2025", isActive: false, isArchived: false },
  });
  const year2526 = await prisma.academicYear.create({
    data: { year: "2025/2026", isActive: true, isArchived: false },
  });

  const years = [year2324, year2425, year2526];
  console.log(`✅ Academic Years: ${years.map((y) => y.year).join(", ")}`);

  // ── CLASSES ──────────────────────────────────────────────────────────
  // 2023/2024: 2 classes
  const class2324A = await prisma.class.create({
    data: { name: "Kelas 4A", academicYearId: year2324.id, homeroomTeacherId: guru1.id },
  });
  const class2324B = await prisma.class.create({
    data: { name: "Kelas 4B", academicYearId: year2324.id, homeroomTeacherId: guru2.id },
  });

  // 2024/2025: 3 classes
  const class2425A = await prisma.class.create({
    data: { name: "Kelas 5A", academicYearId: year2425.id, homeroomTeacherId: guru1.id },
  });
  const class2425B = await prisma.class.create({
    data: { name: "Kelas 5B", academicYearId: year2425.id, homeroomTeacherId: guru2.id },
  });
  const class2425C = await prisma.class.create({
    data: { name: "Kelas 5C", academicYearId: year2425.id, homeroomTeacherId: guru3.id },
  });

  // 2025/2026: 3 classes
  const class2526A = await prisma.class.create({
    data: { name: "Kelas 6A", academicYearId: year2526.id, homeroomTeacherId: guru1.id },
  });
  const class2526B = await prisma.class.create({
    data: { name: "Kelas 6B", academicYearId: year2526.id, homeroomTeacherId: guru2.id },
  });
  const class2526C = await prisma.class.create({
    data: { name: "Kelas 6C", academicYearId: year2526.id, homeroomTeacherId: guru3.id },
  });

  console.log(`✅ Classes: 8 classes across 3 academic years`);

  // ── STUDENTS ─────────────────────────────────────────────────────────
  // Student profiles with varying characteristics
  interface StudentProfile {
    name: string;
    gender: string;
    profile: "top" | "average" | "at-risk" | "inconsistent";
    hasFullRecords: boolean; // has health + attendance + achievements
  }

  const studentProfiles: StudentProfile[] = [
    // Kelas 6A (homeroom: guru1) — students who were in 5A, and 4A before
    { name: "Ahmad Fauzi", gender: "L", profile: "top", hasFullRecords: true },
    { name: "Bunga Citra Lestari", gender: "P", profile: "top", hasFullRecords: true },
    { name: "Cahya Ningsih", gender: "P", profile: "average", hasFullRecords: true },
    { name: "Dwi Prasetyo", gender: "L", profile: "average", hasFullRecords: true },
    { name: "Eka Putri Ayu", gender: "P", profile: "at-risk", hasFullRecords: true },

    // Kelas 6B (homeroom: guru2)
    { name: "Fajar Ramadhan", gender: "L", profile: "average", hasFullRecords: true },
    { name: "Gita Savitri", gender: "P", profile: "top", hasFullRecords: true },
    { name: "Hendra Gunawan", gender: "L", profile: "at-risk", hasFullRecords: false },
    { name: "Indah Permata Sari", gender: "P", profile: "inconsistent", hasFullRecords: true },
    { name: "Joko Susilo", gender: "L", profile: "average", hasFullRecords: true },

    // Kelas 6C (homeroom: guru3)
    { name: "Kartika Sari", gender: "P", profile: "top", hasFullRecords: true },
    { name: "Lukman Hakim", gender: "L", profile: "at-risk", hasFullRecords: true },
    { name: "Maya Anggraini", gender: "P", profile: "average", hasFullRecords: false },
    { name: "Nanda Pratama", gender: "L", profile: "inconsistent", hasFullRecords: true },
    { name: "Olivia Dewi", gender: "P", profile: "average", hasFullRecords: true },
  ];

  const earlyClasses = [class2324A, class2324B];
  const midClasses = [class2425A, class2425B, class2425C];
  const currentClasses = [class2526A, class2526B, class2526C];

  /**
   * Generate scores based on student profile and semester.
   * - top: consistently high (80-98)
   * - average: mid-range (65-88) with slight improvement
   * - at-risk: low and declining (40-75)
   * - inconsistent: volatile scores (50-95)
   */
  function generateScores(profile: string, semester: number, baseOffset: number = 0) {
    return SUBJECTS.map((subject, idx) => {
      let base: number;
      let volatility: number;

      switch (profile) {
        case "top":
          base = 85 + (semester * 2) + baseOffset / 2;
          volatility = 5;
          break;
        case "at-risk":
          base = 60 - (semester * 3) + baseOffset;
          volatility = 10;
          break;
        case "inconsistent":
          base = 70 + (idx % 2 === 0 ? 15 : -10) + (baseOffset * (idx % 2 === 0 ? 1 : -1));
          volatility = 15;
          break;
        case "average":
        default:
          base = 72 + (semester * 1.5) + baseOffset;
          volatility = 8;
          break;
      }

      // Clamp scores
      const knowledgeScore = Math.round(Math.min(100, Math.max(25, base + (Math.random() - 0.5) * volatility * 2)));
      const skillsScore = Math.round(Math.min(100, Math.max(25, base - 3 + (Math.random() - 0.5) * volatility * 2)));

      return {
        subjectName: subject,
        knowledgeScore,
        skillsScore: Math.max(25, skillsScore),
      };
    });
  }

  function generateAttendance(profile: string, semester: number) {
    switch (profile) {
      case "top":
        return { sick: Math.floor(Math.random() * 2), permission: 0, absent: 0 };
      case "at-risk":
        return { sick: Math.floor(Math.random() * 3), permission: Math.floor(Math.random() * 3), absent: 2 + Math.floor(Math.random() * 4) + semester };
      case "inconsistent":
        return { sick: Math.floor(Math.random() * 4), permission: Math.floor(Math.random() * 2), absent: Math.floor(Math.random() * 3) };
      case "average":
      default:
        return { sick: Math.floor(Math.random() * 3), permission: Math.floor(Math.random() * 1), absent: Math.floor(Math.random() * 2) };
    }
  }

  function generateAchievements(profile: string, semester: number) {
    const achievements: { title: string; type: string; description: string }[] = [];

    if (profile === "top") {
      achievements.push(
        { title: "Peringkat 1 Kelas", type: "Akademik", description: "Meraih nilai tertinggi di kelas" },
        { title: semester % 2 === 0 ? "Lomba Matematika" : "Lomba IPA", type: "Akademik", description: "Juara 2 tingkat sekolah" },
      );
      if (semester > 1) {
        achievements.push(
          { title: semester === 2 ? "Pramuka Siaga" : "Pramuka Penggalang", type: "Non-Akademik", description: "Aktif dalam kegiatan pramuka" },
        );
      }
    } else if (profile === "average" && Math.random() > 0.4) {
      achievements.push(
        { title: "Juara Kelas", type: "Akademik", description: "Peringkat 10 besar di kelas" },
      );
    } else if (profile === "inconsistent" && semester % 2 === 0) {
      achievements.push(
        { title: "Lomba Olahraga", type: "Non-Akademik", description: "Partisipasi dalam lomba atletik" },
      );
    }

    return achievements;
  }

  function generateHealthRecord(profile: string) {
    const baseHeight = profile === "top" ? 145 : profile === "at-risk" ? 135 : 140;
    const baseWeight = profile === "top" ? 40 : profile === "at-risk" ? 30 : 35;

    return {
      height: baseHeight + Math.floor(Math.random() * 15),
      weight: baseWeight + Math.floor(Math.random() * 10),
      hearingCondition: Math.random() > 0.9 ? "Perlu pemeriksaan lebih lanjut" : "Normal",
      visionCondition: Math.random() > 0.85 ? "Menggunakan kacamata" : "Normal",
      teethCondition: Math.random() > 0.8 ? "Ada lubang kecil" : "Normal",
    };
  }

  let totalStudents = 0;
  const allStudents: any[] = [];

  for (let i = 0; i < studentProfiles.length; i++) {
    const profile = studentProfiles[i]!;
    const currentClass = currentClasses[Math.floor(i / 5) % 3]!;

    // Determine which previous classes this student was in
    const classIndex = i < 5 ? 0 : i < 10 ? 1 : 2;
    const prevClass2425 = midClasses[classIndex % midClasses.length]!;
    const prevClass2324 = earlyClasses[classIndex % earlyClasses.length]!;

    const student = await prisma.student.create({
      data: {
        nis: `${1000 + i}`,
        nisn: `00${1000 + i}`,
        name: profile.name,
        gender: profile.gender,
        classId: currentClass.id,
      },
    });
    allStudents.push(student);

    // ── 2023/2024 — Semester 1 ──────────────────────────────────────
    const rec2324S1 = await prisma.semesterRecord.create({
      data: {
        studentId: student.id,
        academicYearId: year2324.id,
        semester: 1,
        createdById: guru1.id,
      },
    });

    const scores2324S1 = generateScores(profile.profile, 1, -2);
    for (const s of scores2324S1) {
      await prisma.subjectScore.create({
        data: { semesterRecordId: rec2324S1.id, ...s },
      });
    }

    const att2324S1 = generateAttendance(profile.profile, 1);
    await prisma.attendance.create({
      data: { semesterRecordId: rec2324S1.id, ...att2324S1 },
    });

    const achievements2324S1 = generateAchievements(profile.profile, 1);
    for (const a of achievements2324S1) {
      await prisma.achievement.create({
        data: { semesterRecordId: rec2324S1.id, ...a },
      });
    }

    // ── 2023/2024 — Semester 2 ──────────────────────────────────────
    const rec2324S2 = await prisma.semesterRecord.create({
      data: {
        studentId: student.id,
        academicYearId: year2324.id,
        semester: 2,
        createdById: guru1.id,
      },
    });

    const scores2324S2 = generateScores(profile.profile, 2, profile.profile === "at-risk" ? -5 : 3);
    for (const s of scores2324S2) {
      await prisma.subjectScore.create({
        data: { semesterRecordId: rec2324S2.id, ...s },
      });
    }

    const att2324S2 = generateAttendance(profile.profile, 2);
    await prisma.attendance.create({
      data: { semesterRecordId: rec2324S2.id, ...att2324S2 },
    });

    const achievements2324S2 = generateAchievements(profile.profile, 2);
    for (const a of achievements2324S2) {
      await prisma.achievement.create({
        data: { semesterRecordId: rec2324S2.id, ...a },
      });
    }

    if (profile.hasFullRecords) {
      await prisma.healthRecord.create({
        data: { semesterRecordId: rec2324S2.id, ...generateHealthRecord(profile.profile) },
      });
    }

    // ── 2024/2025 — Semester 1 ──────────────────────────────────────
    const rec2425S1 = await prisma.semesterRecord.create({
      data: {
        studentId: student.id,
        academicYearId: year2425.id,
        semester: 1,
        createdById: guru1.id,
      },
    });

    const scores2425S1 = generateScores(profile.profile, 3, profile.profile === "at-risk" ? -8 : 2);
    for (const s of scores2425S1) {
      await prisma.subjectScore.create({
        data: { semesterRecordId: rec2425S1.id, ...s },
      });
    }

    const att2425S1 = generateAttendance(profile.profile, 3);
    await prisma.attendance.create({
      data: { semesterRecordId: rec2425S1.id, ...att2425S1 },
    });

    const achievements2425S1 = generateAchievements(profile.profile, 3);
    for (const a of achievements2425S1) {
      await prisma.achievement.create({
        data: { semesterRecordId: rec2425S1.id, ...a },
      });
    }

    if (profile.hasFullRecords || Math.random() > 0.5) {
      await prisma.healthRecord.create({
        data: { semesterRecordId: rec2425S1.id, ...generateHealthRecord(profile.profile) },
      });
    }

    // ── 2024/2025 — Semester 2 ──────────────────────────────────────
    const rec2425S2 = await prisma.semesterRecord.create({
      data: {
        studentId: student.id,
        academicYearId: year2425.id,
        semester: 2,
        createdById: guru1.id,
      },
    });

    const scores2425S2 = generateScores(profile.profile, 4, profile.profile === "at-risk" ? -10 : 4);
    for (const s of scores2425S2) {
      await prisma.subjectScore.create({
        data: { semesterRecordId: rec2425S2.id, ...s },
      });
    }

    const att2425S2 = generateAttendance(profile.profile, 4);
    await prisma.attendance.create({
      data: { semesterRecordId: rec2425S2.id, ...att2425S2 },
    });

    const achievements2425S2 = generateAchievements(profile.profile, 4);
    for (const a of achievements2425S2) {
      await prisma.achievement.create({
        data: { semesterRecordId: rec2425S2.id, ...a },
      });
    }

    if (profile.hasFullRecords || Math.random() > 0.4) {
      await prisma.healthRecord.create({
        data: { semesterRecordId: rec2425S2.id, ...generateHealthRecord(profile.profile) },
      });
    }

    // ── 2025/2026 — Semester 1 (Current) ────────────────────────────
    const rec2526S1 = await prisma.semesterRecord.create({
      data: {
        studentId: student.id,
        academicYearId: year2526.id,
        semester: 1,
        createdById: guru1.id,
      },
    });

    const scores2526S1 = generateScores(profile.profile, 5, profile.profile === "at-risk" ? -12 : 5);
    for (const s of scores2526S1) {
      await prisma.subjectScore.create({
        data: { semesterRecordId: rec2526S1.id, ...s },
      });
    }

    const att2526S1 = generateAttendance(profile.profile, 5);
    await prisma.attendance.create({
      data: { semesterRecordId: rec2526S1.id, ...att2526S1 },
    });

    const achievements2526S1 = generateAchievements(profile.profile, 5);
    for (const a of achievements2526S1) {
      await prisma.achievement.create({
        data: { semesterRecordId: rec2526S1.id, ...a },
      });
    }

    // Health record: some students missing it (for validation test)
    if (profile.hasFullRecords) {
      // Only create health record for current semester if hasFullRecords
    } else {
      // Skip health record for current semester to test "incomplete" status
    }

    // ── AI Summaries ────────────────────────────────────────────────
    // Create final summaries for top students, draft for others
    if (profile.profile === "top") {
      await prisma.aiSummary.create({
        data: {
          semesterRecordId: rec2526S1.id,
          summaryType: "STUDENT_SUMMARY",
          content: `${profile.name} menunjukkan performa akademik yang sangat baik di semester ini.${profile.gender === "L" ? " Ia" : " Ia"} konsisten mencapai nilai di atas KKM pada semua mata pelajaran. Sikap belajar yang disiplin dan partisipasi aktif dalam kegiatan kelas menjadi contoh bagi teman-teman.`,
          isFinal: true,
          version: 1,
        },
      });
    } else if (profile.profile === "average") {
      await prisma.aiSummary.create({
        data: {
          semesterRecordId: rec2526S1.id,
          summaryType: "STUDENT_SUMMARY",
          content: `[DRAFT] ${profile.name} menunjukkan perkembangan yang cukup baik. Perlu bimbingan tambahan pada mata pelajaran tertentu untuk mencapai hasil yang lebih optimal.`,
          isFinal: false,
          version: 1,
        },
      });
    }

    // Draft description for a few students
    if (profile.profile === "top" || profile.profile === "inconsistent") {
      await prisma.aiSummary.create({
        data: {
          semesterRecordId: rec2526S1.id,
          summaryType: "DRAFT_DESCRIPTION",
          content: `[DRAFT] Deskripsi rapor untuk ${profile.name}:\n**Matematika**: ${profile.name} memiliki kemampuan numerik yang baik, terus kembangkan.\n**IPA**: Pemahaman konsep sains sudah baik.\n**Bahasa Indonesia**: Keterampilan membaca dan menulis berkembang pesat.`,
          isFinal: false,
          version: 1,
        },
      });
    }

    totalStudents++;
  }

  console.log(`✅ Students: ${totalStudents} students with ${totalStudents * 5} semester records each`);
  console.log(`   - 5 top performers`);
  console.log(`   - 5 average students`);
  console.log(`   - 3 at-risk students`);
  console.log(`   - 2 students with inconsistent scores`);

  // ── ML PREDICTIONS ──────────────────────────────────────────────────
  // Seed some predicted outcomes for the risk model
  for (const student of allStudents) {
    const profile = studentProfiles[allStudents.indexOf(student)]!;
    let riskLevel: string, riskScore: number;

    switch (profile.profile) {
      case "top":
        riskLevel = "AMAN";
        riskScore = 10 + Math.floor(Math.random() * 10);
        break;
      case "at-risk":
        riskLevel = "KRITIS";
        riskScore = 60 + Math.floor(Math.random() * 30);
        break;
      case "inconsistent":
        riskLevel = "WASPADA";
        riskScore = 30 + Math.floor(Math.random() * 20);
        break;
      case "average":
      default:
        riskLevel = Math.random() > 0.6 ? "AMAN" : "WASPADA";
        riskScore = 15 + Math.floor(Math.random() * 25);
        break;
    }

    await prisma.predictedOutcome.create({
      data: {
        studentId: student.id,
        academicYearId: year2526.id,
        modelType: "RISK_CLASSIFICATION",
        label: riskLevel,
        score: riskScore,
        confidence: 0.7 + Math.random() * 0.25,
        features: { avgKnowledge: 70 + Math.random() * 20, avgSkills: 68 + Math.random() * 20, totalAbsence: Math.floor(Math.random() * 10) },
        isActive: true,
      },
    });

    // Trend prediction
    await prisma.predictedOutcome.create({
      data: {
        studentId: student.id,
        academicYearId: year2526.id,
        modelType: "TREND_PREDICTION",
        score: 70 + Math.random() * 25,
        label: profile.profile === "at-risk" ? "TURUN" : profile.profile === "top" ? "NAIK" : "STABIL",
        confidence: 0.65 + Math.random() * 0.3,
        features: { trend: profile.profile === "at-risk" ? "declining" : "stable" },
        isActive: true,
      },
    });
  }

  console.log(`✅ ML Predictions: ${allStudents.length * 2} predicted outcomes`);

  // ── ML MODELS ───────────────────────────────────────────────────────
  await prisma.mlModel.create({
    data: {
      name: "Risk Classification v1",
      modelType: "RISK_CLASSIFICATION",
      version: 1,
      filePath: "./models/risk-v1.onnx",
      metrics: { accuracy: 0.85, f1: 0.82, precision: 0.80, recall: 0.78 },
      featureList: ["avgKnowledge", "avgSkills", "scoreVolatility", "scoreDelta", "totalAbsence", "absenceTrend", "achievementCount", "semesterCount"],
      isActive: true,
      trainedAt: new Date("2026-01-15"),
    },
  });

  await prisma.mlModel.create({
    data: {
      name: "Trend Prediction v1",
      modelType: "TREND_PREDICTION",
      version: 1,
      filePath: "./models/trend-v1.onnx",
      metrics: { mae: 5.2, rmse: 7.8, r2: 0.72 },
      featureList: ["avgKnowledge", "avgSkills", "scoreVolatility", "scoreDelta", "totalAbsence", "semesterCount"],
      isActive: true,
      trainedAt: new Date("2026-02-01"),
    },
  });

  await prisma.mlModel.create({
    data: {
      name: "Behavior Cluster v1",
      modelType: "BEHAVIOR_CLUSTER",
      version: 1,
      filePath: null,
      metrics: { silhouette: 0.65, clusters: 3 },
      isActive: false,
    },
  });

  console.log(`✅ ML Models: 3 models registered`);

  // ── CLASS AUDIT LOGS ────────────────────────────────────────────────
  // Simulate teacher assignment history
  await prisma.classAuditLog.create({
    data: {
      classId: class2526A.id,
      previousTeacherId: null,
      newTeacherId: guru1.id,
      changedById: admin.id,
    },
  });

  await prisma.classAuditLog.create({
    data: {
      classId: class2526B.id,
      previousTeacherId: null,
      newTeacherId: guru2.id,
      changedById: admin.id,
    },
  });

  await prisma.classAuditLog.create({
    data: {
      classId: class2526C.id,
      previousTeacherId: null,
      newTeacherId: guru3.id,
      changedById: admin.id,
    },
  });

  console.log(`✅ Audit logs: 3 class audit records`);

  // ── CREDENTIALS ─────────────────────────────────────────────────────
  console.log("");
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║           LOGIN CREDENTIALS                  ║");
  console.log("╠══════════════════════════════════════════════╣");
  console.log("║  admin   │ admin123  │ ADMINISTRATOR        ║");
  console.log("║  operator│ operator123│ OPERATOR_SEKOLAH    ║");
  console.log("║  guru1   │ guru123   │ GURU (Kelas 6A/4A)  ║");
  console.log("║  guru2   │ guru123   │ GURU (Kelas 6B/5B)  ║");
  console.log("║  guru3   │ guru123   │ GURU (Kelas 6C/5C)  ║");
  console.log("║  kepsek  │ kepsek123 │ KEPALA_SEKOLAH      ║");
  console.log("╚══════════════════════════════════════════════╝");
  console.log("");
  console.log("🎯 Seed Data Summary:");
  console.log(`   - Users: 6`);
  console.log(`   - Academic Years: 3 (2023/2024, 2024/2025, 2025/2026)`);
  console.log(`   - Classes: 8`);
  console.log(`   - Students: ${totalStudents}`);
  console.log(`   - Total Semester Records: ${totalStudents * 5}`);
  console.log(`   - ML Predictions: ${allStudents.length * 2}`);
  console.log(`   - ML Models: 3`);
  console.log(`   - AI Summaries: varies per student profile`);
  console.log("✅ Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
