import { describe, expect, it, beforeAll } from "bun:test";
import { cleanDb, prisma } from "./setup";
import { computeFeatures } from "../src/modules/ml/features";
import { assessRisk, trendSummary, type RiskLevel } from "../src/modules/ml/rules";
import * as mlService from "../src/modules/ml/ml.service";

describe("ML Features — computeFeatures", () => {
  beforeAll(async () => { await cleanDb(); });

  async function seedStudentWithRecords(opts: {
    scoreValues?: number[];
    attendanceValues?: { sick: number; permission: number; absent: number }[];
    achievementCounts?: number[];
    numSemesters?: number;
  }) {
    const year = await prisma.academicYear.create({ data: { year: "2025/2026" } });
    const cls = await prisma.class.create({ data: { name: "Kelas 5A", academicYearId: year.id } });
    const user = await prisma.user.create({ data: { username: `g-${Date.now()}`, password: "x", name: "G", role: "GURU" } });
    const student = await prisma.student.create({ data: { name: "Test", classId: cls.id, nis: `T${Date.now()}`, nisn: `TN${Date.now()}`, gender: "L" } });

    const numSemesters = opts.numSemesters ?? 2;
    const scoreValues = opts.scoreValues ?? [85, 80];
    const attendanceValues = opts.attendanceValues ?? [{ sick: 0, permission: 0, absent: 0 }, { sick: 1, permission: 0, absent: 0 }];
    const achievementCounts = opts.achievementCounts ?? [1, 1];

    for (let sem = 0; sem < numSemesters; sem++) {
      const rec = await prisma.semesterRecord.create({
        data: { studentId: student.id, academicYearId: year.id, semester: sem + 1, createdById: user.id },
      });

      // Create 3 subject scores per semester using the provided score value
      const baseScore = scoreValues[Math.min(sem, scoreValues.length - 1)] ?? 75;
      await prisma.subjectScore.create({
        data: { semesterRecordId: rec.id, subjectName: "Matematika", knowledgeScore: baseScore, skillsScore: baseScore - 3 },
      });
      await prisma.subjectScore.create({
        data: { semesterRecordId: rec.id, subjectName: "IPA", knowledgeScore: baseScore + 5, skillsScore: baseScore },
      });
      await prisma.subjectScore.create({
        data: { semesterRecordId: rec.id, subjectName: "Bahasa Indonesia", knowledgeScore: baseScore - 2, skillsScore: baseScore - 5 },
      });

      const att = attendanceValues[Math.min(sem, attendanceValues.length - 1)] ?? { sick: 0, permission: 0, absent: 0 };
      await prisma.attendance.create({ data: { semesterRecordId: rec.id, ...att } });

      const achCount = achievementCounts[Math.min(sem, achievementCounts.length - 1)] ?? 0;
      for (let a = 0; a < achCount; a++) {
        await prisma.achievement.create({ data: { semesterRecordId: rec.id, title: `Achievement ${a + 1}`, type: "Akademik" } });
      }
    }

    return { student, year };
  }

  it("returns zero features for student with no records", async () => {
    const cls = await prisma.class.create({ data: { name: "Kelas 5A", academicYearId: (await prisma.academicYear.create({ data: { year: "2026/2027" } })).id } });
    const student = await prisma.student.create({ data: { name: "No Record", classId: cls.id, nis: "NO-REC", nisn: "NO-RECN", gender: "L" } });

    const features = await computeFeatures(student.id);
    expect(features.avgKnowledge).toBe(0);
    expect(features.avgSkills).toBe(0);
    expect(features.scoreVolatility).toBe(0);
    expect(features.scoreDelta).toBe(0);
    expect(features.totalAbsence).toBe(0);
    expect(features.absenceTrend).toBe(0);
    expect(features.achievementCount).toBe(0);
    expect(features.semesterCount).toBe(0);
  });

  it("computes features for student with one semester", async () => {
    const { student } = await seedStudentWithRecords({ numSemesters: 1, scoreValues: [80] });
    const features = await computeFeatures(student.id);
    expect(features.semesterCount).toBe(1);
    expect(features.avgKnowledge).toBeGreaterThan(0);
    expect(features.scoreDelta).toBe(0); // only 1 semester, no delta
    expect(features.absenceTrend).toBe(0); // only 1 semester, no trend
  });

  it("computes correct averages across multiple semesters", async () => {
    const { student } = await seedStudentWithRecords({ scoreValues: [80, 90] });
    const features = await computeFeatures(student.id);
    // Sem1: scores [80, 85, 78], Sem2: scores [90, 95, 88]
    // avg = (80+85+78+90+95+88) / 6 = 516/6 = 86
    expect(features.avgKnowledge).toBeGreaterThanOrEqual(85);
    expect(features.avgKnowledge).toBeLessThanOrEqual(87);
    expect(features.semesterCount).toBe(2);
  });

  it("calculates positive score delta for improvement", async () => {
    const { student } = await seedStudentWithRecords({ scoreValues: [70, 95] });
    const features = await computeFeatures(student.id);
    // Sem1 avg ≈ 70+75+68 /3 = 71, Sem2 avg ≈ 95+100+93 /3 = 96
    // delta ≈ 96 - 71 ≈ 25
    expect(features.scoreDelta).toBeGreaterThan(20);
  });

  it("calculates negative score delta for decline", async () => {
    const { student } = await seedStudentWithRecords({ scoreValues: [90, 60] });
    const features = await computeFeatures(student.id);
    // Sem1 avg ≈ 90, Sem2 avg ≈ 60, delta ≈ -30
    expect(features.scoreDelta).toBeLessThan(-25);
  });

  it("calculates absence totals correctly", async () => {
    const { student } = await seedStudentWithRecords({
      scoreValues: [80, 80],
      attendanceValues: [
        { sick: 2, permission: 1, absent: 0 },
        { sick: 1, permission: 2, absent: 3 },
      ],
    });
    const features = await computeFeatures(student.id);
    expect(features.totalAbsence).toBe(9); // (2+1+0) + (1+2+3) = 9
    expect(features.absenceTrend).toBe(3); // absent[1] - absent[0] = 3 - 0 = 3
  });

  it("counts achievements across semesters", async () => {
    const { student } = await seedStudentWithRecords({ achievementCounts: [2, 3] });
    const features = await computeFeatures(student.id);
    expect(features.achievementCount).toBe(5);
  });

  it("handles missing attendance gracefully", async () => {
    const year = await prisma.academicYear.create({ data: { year: "2027/2028" } });
    const cls = await prisma.class.create({ data: { name: "Kelas 5A", academicYearId: year.id } });
    const user = await prisma.user.create({ data: { username: `g-miss-${Date.now()}`, password: "x", name: "G", role: "GURU" } });
    const student = await prisma.student.create({ data: { name: "No Att", classId: cls.id, nis: `NO-ATT-${Date.now()}`, nisn: `NO-ATTN-${Date.now()}`, gender: "L" } });
    const rec = await prisma.semesterRecord.create({ data: { studentId: student.id, academicYearId: year.id, semester: 1, createdById: user.id } });
    await prisma.subjectScore.create({ data: { semesterRecordId: rec.id, subjectName: "Matematika", knowledgeScore: 80, skillsScore: 75 } });
    // No attendance record

    const features = await computeFeatures(student.id);
    expect(features.totalAbsence).toBe(0); // no attendance records = 0 absence
    expect(features.avgKnowledge).toBe(80);
  });
});

describe("ML Rules — assessRisk", () => {
  it("returns AMAN for top performer", () => {
    const risk = assessRisk({
      studentId: "x", avgKnowledge: 88, avgSkills: 85, scoreVolatility: 3, scoreDelta: 5,
      totalAbsence: 0, absenceTrend: 0, achievementCount: 3, semesterCount: 2,
    });
    expect(risk.level).toBe("AMAN");
    expect(risk.score).toBeLessThan(25);
    expect(risk.recommendations).toContain("Pertahankan performa akademik");
  });

  it("returns KRITIS for severely declining student", () => {
    const risk = assessRisk({
      studentId: "x", avgKnowledge: 55, avgSkills: 50, scoreVolatility: 20, scoreDelta: -25,
      totalAbsence: 15, absenceTrend: 4, achievementCount: 0, semesterCount: 3,
    });
    expect(risk.level).toBe("KRITIS");
    expect(risk.score).toBeGreaterThanOrEqual(50);
    expect(risk.factors.length).toBeGreaterThanOrEqual(3);
  });

  it("returns WASPADA for moderate risk factors", () => {
    const risk = assessRisk({
      studentId: "x", avgKnowledge: 72, avgSkills: 70, scoreVolatility: 12, scoreDelta: -8,
      totalAbsence: 4, absenceTrend: 1, achievementCount: 1, semesterCount: 2,
    });
    expect(risk.level).toBe("WASPADA");
    expect(risk.score).toBeGreaterThanOrEqual(25);
    expect(risk.score).toBeLessThan(50);
  });

  it("returns AMAN for borderline scores with good attendance", () => {
    const risk = assessRisk({
      studentId: "x", avgKnowledge: 75, avgSkills: 73, scoreVolatility: 8, scoreDelta: -3,
      totalAbsence: 2, absenceTrend: 0, achievementCount: 1, semesterCount: 2,
    });
    expect(risk.level).toBe("AMAN");
  });

  it("detects high absenteeism as risk factor", () => {
    const risk = assessRisk({
      studentId: "x", avgKnowledge: 80, avgSkills: 78, scoreVolatility: 5, scoreDelta: 2,
      totalAbsence: 20, absenceTrend: 0, achievementCount: 1, semesterCount: 2,
    });
    // avgAbsence = 20/2 = 10 > 5 → +20
    expect(risk.score).toBeGreaterThanOrEqual(20);
    expect(risk.factors.some((f) => f.includes("ketidakhadiran"))).toBe(true);
  });

  it("detects increasing alpha trend", () => {
    const risk = assessRisk({
      studentId: "x", avgKnowledge: 80, avgSkills: 78, scoreVolatility: 5, scoreDelta: 2,
      totalAbsence: 6, absenceTrend: 3, achievementCount: 1, semesterCount: 2,
    });
    expect(risk.factors.some((f) => f.includes("alpha"))).toBe(true);
  });

  it("detects declining score trend", () => {
    const risk = assessRisk({
      studentId: "x", avgKnowledge: 75, avgSkills: 73, scoreVolatility: 5, scoreDelta: -12,
      totalAbsence: 2, absenceTrend: 0, achievementCount: 1, semesterCount: 2,
    });
    expect(risk.factors.some((f) => f.includes("turun"))).toBe(true);
  });

  it("detects low average knowledge", () => {
    const risk = assessRisk({
      studentId: "x", avgKnowledge: 65, avgSkills: 63, scoreVolatility: 5, scoreDelta: 0,
      totalAbsence: 2, absenceTrend: 0, achievementCount: 1, semesterCount: 2,
    });
    expect(risk.factors.some((f) => f.includes("70"))).toBe(true);
  });

  it("detects high volatility", () => {
    const risk = assessRisk({
      studentId: "x", avgKnowledge: 80, avgSkills: 78, scoreVolatility: 18, scoreDelta: 3,
      totalAbsence: 2, absenceTrend: 0, achievementCount: 1, semesterCount: 2,
    });
    expect(risk.factors.some((f) => f.includes("volatilitas"))).toBe(true);
  });

  it("flags missing achievements after multiple semesters", () => {
    const risk = assessRisk({
      studentId: "x", avgKnowledge: 82, avgSkills: 80, scoreVolatility: 5, scoreDelta: 0,
      totalAbsence: 2, absenceTrend: 0, achievementCount: 0, semesterCount: 3,
    });
    expect(risk.factors.some((f) => f.includes("prestasi"))).toBe(true);
  });

  it("caps risk score at 100", () => {
    const risk = assessRisk({
      studentId: "x", avgKnowledge: 30, avgSkills: 28, scoreVolatility: 25, scoreDelta: -30,
      totalAbsence: 50, absenceTrend: 5, achievementCount: 0, semesterCount: 4,
    });
    expect(risk.score).toBeLessThanOrEqual(100);
  });

  it("handles single semester (no delta, no trend)", () => {
    const risk = assessRisk({
      studentId: "x", avgKnowledge: 85, avgSkills: 83, scoreVolatility: 0, scoreDelta: 0,
      totalAbsence: 0, absenceTrend: 0, achievementCount: 2, semesterCount: 1,
    });
    expect(risk.level).toBe("AMAN");
  });

  it("includes relevant recommendations for each risk factor", () => {
    const risk = assessRisk({
      studentId: "x", avgKnowledge: 55, avgSkills: 50, scoreVolatility: 18, scoreDelta: -15,
      totalAbsence: 12, absenceTrend: 3, achievementCount: 0, semesterCount: 3,
    });
    expect(risk.recommendations.length).toBeGreaterThanOrEqual(2);
    expect(risk.recommendations.some((r) => r.includes("Review metode belajar"))).toBe(true);
    expect(risk.recommendations.some((r) => r.includes("orang tua"))).toBe(true);
  });
});

describe("ML Rules — trendSummary", () => {
  it("returns STABIL for single semester", () => {
    const trend = trendSummary({
      studentId: "x", avgKnowledge: 80, avgSkills: 78, scoreVolatility: 0, scoreDelta: 0,
      totalAbsence: 0, absenceTrend: 0, achievementCount: 0, semesterCount: 1,
    });
    expect(trend.trend).toBe("STABIL");
    expect(trend.description).toContain("belum cukup");
  });

  it("returns NAIK for positive score delta", () => {
    const trend = trendSummary({
      studentId: "x", avgKnowledge: 85, avgSkills: 80, scoreVolatility: 5, scoreDelta: 8,
      totalAbsence: 0, absenceTrend: 0, achievementCount: 2, semesterCount: 2,
    });
    expect(trend.trend).toBe("NAIK");
    expect(trend.description).toContain("meningkat");
  });

  it("returns TURUN for negative score delta", () => {
    const trend = trendSummary({
      studentId: "x", avgKnowledge: 70, avgSkills: 68, scoreVolatility: 10, scoreDelta: -12,
      totalAbsence: 5, absenceTrend: 2, achievementCount: 0, semesterCount: 2,
    });
    expect(trend.trend).toBe("TURUN");
    expect(trend.description).toContain("turun");
  });

  it("returns STABIL for small score delta", () => {
    const trend = trendSummary({
      studentId: "x", avgKnowledge: 80, avgSkills: 78, scoreVolatility: 3, scoreDelta: 3,
      totalAbsence: 1, absenceTrend: 0, achievementCount: 1, semesterCount: 2,
    });
    expect(trend.trend).toBe("STABIL");
    expect(trend.description).toContain("stabil");
  });

  it("returns STABIL for exactly -5 delta (boundary)", () => {
    const trend = trendSummary({
      studentId: "x", avgKnowledge: 75, avgSkills: 73, scoreVolatility: 4, scoreDelta: -5,
      totalAbsence: 2, absenceTrend: 0, achievementCount: 1, semesterCount: 2,
    });
    // boundary: -5 is NOT less than -5, so STABIL
    expect(trend.trend).toBe("STABIL");
  });

  it("returns TURUN for exactly -5.1 delta (boundary)", () => {
    const trend = trendSummary({
      studentId: "x", avgKnowledge: 70, avgSkills: 68, scoreVolatility: 8, scoreDelta: -5.1,
      totalAbsence: 3, absenceTrend: 1, achievementCount: 0, semesterCount: 2,
    });
    expect(trend.trend).toBe("TURUN");
  });
});

describe("ML Service — getStudentRisk", () => {
  beforeAll(async () => { await cleanDb(); });

  it("returns risk assessment for existing student", async () => {
    const year = await prisma.academicYear.create({ data: { year: "2025/2026" } });
    const cls = await prisma.class.create({ data: { name: "Kelas 5A", academicYearId: year.id } });
    const user = await prisma.user.create({ data: { username: `g-risk-${Date.now()}`, password: "x", name: "G", role: "GURU" } });
    const student = await prisma.student.create({ data: { name: "Risk Student", classId: cls.id, nis: `RISK-${Date.now()}`, nisn: `RISKN-${Date.now()}`, gender: "L" } });
    const rec = await prisma.semesterRecord.create({ data: { studentId: student.id, academicYearId: year.id, semester: 1, createdById: user.id } });
    await prisma.subjectScore.create({ data: { semesterRecordId: rec.id, subjectName: "Matematika", knowledgeScore: 75, skillsScore: 70 } });
    await prisma.attendance.create({ data: { semesterRecordId: rec.id, sick: 1, permission: 0, absent: 0 } });

    const result = await mlService.getStudentRisk(student.id);
    expect(result.risk).toBeDefined();
    expect(result.risk.level).toMatch(/^(AMAN|WASPADA|KRITIS)$/);
    expect(result.features).toBeDefined();
    expect(result.features.semesterCount).toBe(1);
    expect(result.trend).toBeDefined();
  });

  it("throws NotFoundError for non-existent student", async () => {
    expect(mlService.getStudentRisk("nonexistent-id")).rejects.toThrow();
  });
});

describe("ML Service — getClassRisk", () => {
  beforeAll(async () => { await cleanDb(); });

  it("returns risk assessment for all students in class", async () => {
    const year = await prisma.academicYear.create({ data: { year: "2025/2026" } });
    const cls = await prisma.class.create({ data: { name: "Kelas 5A", academicYearId: year.id } });
    const user = await prisma.user.create({ data: { username: `g-crisk-${Date.now()}`, password: "x", name: "G", role: "GURU" } });

    for (let i = 0; i < 3; i++) {
      const student = await prisma.student.create({ data: { name: `S${i}`, classId: cls.id, nis: `C${i}-${Date.now()}`, nisn: `CN${i}-${Date.now()}`, gender: i % 2 === 0 ? "L" : "P" } });
      const rec = await prisma.semesterRecord.create({ data: { studentId: student.id, academicYearId: year.id, semester: 1, createdById: user.id } });
      await prisma.subjectScore.create({ data: { semesterRecordId: rec.id, subjectName: "Matematika", knowledgeScore: 70 + i * 10, skillsScore: 65 + i * 10 } });
    }

    const result = await mlService.getClassRisk(cls.id);
    expect(result.results.length).toBe(3);
    expect(result.summary.total).toBe(3);
    expect(result.results).toBeSortedByRiskDescending();
  });

  it("returns empty for class with no students", async () => {
    const year = await prisma.academicYear.create({ data: { year: "2025/2026" } });
    const cls = await prisma.class.create({ data: { name: "Empty Class", academicYearId: year.id } });
    const result = await mlService.getClassRisk(cls.id);
    expect(result.results).toEqual([]);
    expect(result.summary.total).toBe(0);
  });
});

describe("ML Service — getStudentTrend", () => {
  beforeAll(async () => { await cleanDb(); });

  it("returns trend analysis for student", async () => {
    const year = await prisma.academicYear.create({ data: { year: "2025/2026" } });
    const cls = await prisma.class.create({ data: { name: "Kelas 5A", academicYearId: year.id } });
    const user = await prisma.user.create({ data: { username: `g-trend-${Date.now()}`, password: "x", name: "G", role: "GURU" } });
    const student = await prisma.student.create({ data: { name: "Trend Student", classId: cls.id, nis: `TREND-${Date.now()}`, nisn: `TRENDN-${Date.now()}`, gender: "L" } });

    // Create 2 semesters with declining scores
    const rec1 = await prisma.semesterRecord.create({ data: { studentId: student.id, academicYearId: year.id, semester: 1, createdById: user.id } });
    await prisma.subjectScore.create({ data: { semesterRecordId: rec1.id, subjectName: "Matematika", knowledgeScore: 90, skillsScore: 85 } });

    const rec2 = await prisma.semesterRecord.create({ data: { studentId: student.id, academicYearId: year.id, semester: 2, createdById: user.id } });
    await prisma.subjectScore.create({ data: { semesterRecordId: rec2.id, subjectName: "Matematika", knowledgeScore: 75, skillsScore: 70 } });

    const result = await mlService.getStudentTrend(student.id);
    expect(result.features).toBeDefined();
    expect(result.trend).toBeDefined();
    expect(result.trend.trend).toBe("TURUN");
  });

  it("throws for non-existent student", async () => {
    expect(mlService.getStudentTrend("nonexistent")).rejects.toThrow();
  });
});

describe("ML Service — getModels", () => {
  beforeAll(async () => { await cleanDb(); });

  it("returns empty list when no models exist", async () => {
    const models = await mlService.getModels();
    expect(models).toEqual([]);
  });

  it("returns all registered models", async () => {
    await prisma.mlModel.create({
      data: { name: "Test Model", modelType: "RISK_CLASSIFICATION", version: 1, isActive: true, metrics: { acc: 0.9 } },
    });
    const models = await mlService.getModels();
    expect(models.length).toBe(1);
    expect(models[0].name).toBe("Test Model");
  });
});

describe("ML Service — getOutcomes", () => {
  beforeAll(async () => { await cleanDb(); });

  it("returns all outcomes when no studentId filter", async () => {
    const year = await prisma.academicYear.create({ data: { year: "2025/2026" } });
    const cls = await prisma.class.create({ data: { name: "Kelas 5A", academicYearId: year.id } });
    const student = await prisma.student.create({ data: { name: "Outcome Student", classId: cls.id, nis: `OUT-${Date.now()}`, nisn: `OUTN-${Date.now()}`, gender: "L" } });
    await prisma.predictedOutcome.create({
      data: { studentId: student.id, academicYearId: year.id, modelType: "RISK_CLASSIFICATION", label: "AMAN", isActive: true },
    });

    const outcomes = await mlService.getOutcomes();
    expect(outcomes.length).toBe(1);
    expect(outcomes[0].student.name).toBe("Outcome Student");
  });

  it("filters by studentId", async () => {
    const year = await prisma.academicYear.create({ data: { year: "2025/2026" } });
    const cls = await prisma.class.create({ data: { name: "Kelas 5A", academicYearId: year.id } });
    const s1 = await prisma.student.create({ data: { name: "S1", classId: cls.id, nis: `O1-${Date.now()}`, nisn: `O1N-${Date.now()}`, gender: "L" } });
    const s2 = await prisma.student.create({ data: { name: "S2", classId: cls.id, nis: `O2-${Date.now()}`, nisn: `O2N-${Date.now()}`, gender: "P" } });
    await prisma.predictedOutcome.create({ data: { studentId: s1.id, modelType: "RISK_CLASSIFICATION", label: "AMAN", isActive: true } });
    await prisma.predictedOutcome.create({ data: { studentId: s2.id, modelType: "RISK_CLASSIFICATION", label: "WASPADA", isActive: true } });

    const outcomes = await mlService.getOutcomes(s1.id);
    expect(outcomes.length).toBe(1);
    expect(outcomes[0].studentId).toBe(s1.id);
  });

  it("returns only active outcomes", async () => {
    const student = await prisma.student.create({ data: { name: "S3", classId: (await prisma.class.create({ data: { name: "Kelas 5A", academicYearId: (await prisma.academicYear.create({ data: { year: "2025/2026" } })).id } })).id, nis: `O3-${Date.now()}`, nisn: `O3N-${Date.now()}`, gender: "L" } });
    await prisma.predictedOutcome.create({ data: { studentId: student.id, modelType: "RISK_CLASSIFICATION", label: "AMAN", isActive: true } });
    await prisma.predictedOutcome.create({ data: { studentId: student.id, modelType: "RISK_CLASSIFICATION", label: "LAMA", isActive: false } });
    await prisma.predictedOutcome.create({ data: { studentId: student.id, modelType: "TREND_PREDICTION", label: "NAIK", isActive: true } });

    const outcomes = await mlService.getOutcomes(student.id);
    expect(outcomes.length).toBe(2); // only active ones
  });
});

// Custom matcher helper
expect.extend({
  toBeSortedByRiskDescending(received: Array<{ risk: { score: number } }>) {
    const pass = received.every((item, i) => i === 0 || item.risk.score <= received[i - 1].risk.score);
    return { pass, message: () => "Expected results to be sorted by risk score descending" };
  },
});
