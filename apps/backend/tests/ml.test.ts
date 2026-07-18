import { describe, expect, it, beforeAll } from "bun:test";
import { cleanDb, prisma } from "./setup";
import { resetCache } from "../src/modules/ml/trainer";
import { computeFeatures } from "../src/modules/ml/features";
import { evaluateRisk } from "../src/modules/ml/scoring-engine";
import { analyzeFeatures, analyzeRiskDistribution } from "../src/modules/ml/model-evaluator";
import { trainLinearRegression } from "../src/modules/ml/models/linear-regression";
import * as mlService from "../src/modules/ml/ml.service";

// Only test core logic that doesn't depend on LLM agent calls
// (LLM agent calls timeout with no API key)

describe("ML Features — computeFeatures", () => {
  let yearId: string, classId: string, userId: string;

  beforeAll(async () => {
    await cleanDb();
    const year = await prisma.academicYear.create({ data: { year: "MLF-2025/2026" } });
    yearId = year.id;
    const cls = await prisma.class.create({ data: { name: "MLF-C", academicYearId: year.id } });
    classId = cls.id;
    const u = await prisma.user.create({ data: { username: "mlf-u", password: "x", name: "X", role: "GURU" } });
    userId = u.id;
  });

  it("zero features for no records", async () => {
    const s = await prisma.student.create({ data: { name: "Z", classId, nis: "MLF-Z", nisn: "MLF-ZN", gender: "L" } });
    const f = await computeFeatures(s.id);
    expect(f.semesterCount).toBe(0);
    expect(f.avgKnowledge).toBe(0);
  });

  it("features for one semester", async () => {
    const s = await prisma.student.create({ data: { name: "O", classId, nis: "MLF-O", nisn: "MLF-ON", gender: "L" } });
    const rec = await prisma.semesterRecord.create({ data: { studentId: s.id, academicYearId: yearId, semester: 1, createdById: userId } });
    await prisma.subjectScore.create({ data: { semesterRecordId: rec.id, subjectName: "M", knowledgeScore: 80, skillsScore: 75 } });
    const f = await computeFeatures(s.id);
    expect(f.avgKnowledge).toBe(80);
    expect(f.semesterCount).toBe(1);
  });

  it("average across 2 semesters", async () => {
    const s = await prisma.student.create({ data: { name: "A", classId, nis: "MLF-A", nisn: "MLF-AN", gender: "L" } });
    const r1 = await prisma.semesterRecord.create({ data: { studentId: s.id, academicYearId: yearId, semester: 1, createdById: userId } });
    await prisma.subjectScore.create({ data: { semesterRecordId: r1.id, subjectName: "M", knowledgeScore: 80, skillsScore: 75 } });
    const r2 = await prisma.semesterRecord.create({ data: { studentId: s.id, academicYearId: yearId, semester: 2, createdById: userId } });
    await prisma.subjectScore.create({ data: { semesterRecordId: r2.id, subjectName: "M", knowledgeScore: 90, skillsScore: 85 } });
    expect((await computeFeatures(s.id)).avgKnowledge).toBe(85);
  });

  it("positive score delta", async () => {
    const s = await prisma.student.create({ data: { name: "P", classId, nis: "MLF-P", nisn: "MLF-PN", gender: "L" } });
    const r1 = await prisma.semesterRecord.create({ data: { studentId: s.id, academicYearId: yearId, semester: 1, createdById: userId } });
    await prisma.subjectScore.create({ data: { semesterRecordId: r1.id, subjectName: "M", knowledgeScore: 70, skillsScore: 65 } });
    const r2 = await prisma.semesterRecord.create({ data: { studentId: s.id, academicYearId: yearId, semester: 2, createdById: userId } });
    await prisma.subjectScore.create({ data: { semesterRecordId: r2.id, subjectName: "M", knowledgeScore: 95, skillsScore: 90 } });
    expect((await computeFeatures(s.id)).scoreDelta).toBe(25);
  });

  it("negative score delta", async () => {
    const s = await prisma.student.create({ data: { name: "N", classId, nis: "MLF-N", nisn: "MLF-NN", gender: "L" } });
    const r1 = await prisma.semesterRecord.create({ data: { studentId: s.id, academicYearId: yearId, semester: 1, createdById: userId } });
    await prisma.subjectScore.create({ data: { semesterRecordId: r1.id, subjectName: "M", knowledgeScore: 90, skillsScore: 85 } });
    const r2 = await prisma.semesterRecord.create({ data: { studentId: s.id, academicYearId: yearId, semester: 2, createdById: userId } });
    await prisma.subjectScore.create({ data: { semesterRecordId: r2.id, subjectName: "M", knowledgeScore: 60, skillsScore: 55 } });
    expect((await computeFeatures(s.id)).scoreDelta).toBe(-30);
  });

  it("absence totals", async () => {
    const s = await prisma.student.create({ data: { name: "Ab", classId, nis: "MLF-AB", nisn: "MLF-ABN", gender: "L" } });
    const r1 = await prisma.semesterRecord.create({ data: { studentId: s.id, academicYearId: yearId, semester: 1, createdById: userId } });
    await prisma.subjectScore.create({ data: { semesterRecordId: r1.id, subjectName: "M", knowledgeScore: 80, skillsScore: 75 } });
    await prisma.attendance.create({ data: { semesterRecordId: r1.id, sick: 2, permission: 1, absent: 0 } });
    const r2 = await prisma.semesterRecord.create({ data: { studentId: s.id, academicYearId: yearId, semester: 2, createdById: userId } });
    await prisma.subjectScore.create({ data: { semesterRecordId: r2.id, subjectName: "M", knowledgeScore: 80, skillsScore: 75 } });
    await prisma.attendance.create({ data: { semesterRecordId: r2.id, sick: 1, permission: 2, absent: 3 } });
    const f = await computeFeatures(s.id);
    expect(f.totalAbsence).toBe(9);
    expect(f.absenceTrend).toBe(3);
  });

  it("achievement counts", async () => {
    const s = await prisma.student.create({ data: { name: "Ac", classId, nis: "MLF-AC", nisn: "MLF-ACN", gender: "L" } });
    const r1 = await prisma.semesterRecord.create({ data: { studentId: s.id, academicYearId: yearId, semester: 1, createdById: userId } });
    await prisma.subjectScore.create({ data: { semesterRecordId: r1.id, subjectName: "M", knowledgeScore: 80, skillsScore: 75 } });
    await prisma.achievement.create({ data: { semesterRecordId: r1.id, title: "A1", type: "A" } });
    await prisma.achievement.create({ data: { semesterRecordId: r1.id, title: "A2", type: "N" } });
    expect((await computeFeatures(s.id)).achievementCount).toBe(2);
  });

  it("missing attendance", async () => {
    const s = await prisma.student.create({ data: { name: "NA", classId, nis: "MLF-NA", nisn: "MLF-NAN", gender: "L" } });
    const rec = await prisma.semesterRecord.create({ data: { studentId: s.id, academicYearId: yearId, semester: 1, createdById: userId } });
    await prisma.subjectScore.create({ data: { semesterRecordId: rec.id, subjectName: "M", knowledgeScore: 80, skillsScore: 75 } });
    const f = await computeFeatures(s.id);
    expect(f.totalAbsence).toBe(0);
    expect(f.avgKnowledge).toBe(80);
  });
});

// Test ML service functions that don't require LLM
describe("ML Service — getModels", () => {
  beforeAll(async () => { await cleanDb(); resetCache(); });

  it("returns model status", async () => {
    const models = await mlService.getModels();
    expect(models).toBeDefined();
    expect("hasClusterModel" in models).toBe(true);
    expect("meta" in models).toBe(true);
  });
});

describe("ML Service — getOutcomes", () => {
  beforeAll(async () => { await cleanDb(); });

  it("returns outcomes", async () => {
    const year = await prisma.academicYear.create({ data: { year: "ML-OUT-2025/2026" } });
    const cls = await prisma.class.create({ data: { name: "OC", academicYearId: year.id } });
    const s = await prisma.student.create({ data: { name: "OS", classId: cls.id, nis: "ML-OUT", nisn: "ML-ON", gender: "L" } });
    await prisma.predictedOutcome.create({ data: { studentId: s.id, academicYearId: year.id, modelType: "RISK_CLASSIFICATION", label: "AMAN", isActive: true } });
    expect((await mlService.getOutcomes()).length).toBe(1);
  });

  it("filters by studentId", async () => {
    const year = await prisma.academicYear.create({ data: { year: "ML-FIL-2025/2026" } });
    const cls = await prisma.class.create({ data: { name: "FC", academicYearId: year.id } });
    const s1 = await prisma.student.create({ data: { name: "F1", classId: cls.id, nis: "ML-F1", nisn: "ML-F1N", gender: "L" } });
    const s2 = await prisma.student.create({ data: { name: "F2", classId: cls.id, nis: "ML-F2", nisn: "ML-F2N", gender: "P" } });
    await prisma.predictedOutcome.create({ data: { studentId: s1.id, modelType: "RISK_CLASSIFICATION", label: "AMAN", isActive: true } });
    await prisma.predictedOutcome.create({ data: { studentId: s2.id, modelType: "RISK_CLASSIFICATION", label: "WASPADA", isActive: true } });
    expect((await mlService.getOutcomes(s1.id)).length).toBe(1);
  });
});

describe("ScoringEngine — evaluateRisk", () => {
  it("returns AMAN for good student", () => {
    const r = evaluateRisk({
      avgKnowledge: 88, scoreVolatility: 5, totalAbsence: 2,
      scoreDelta: 3, semesterCount: 4, achievementCount: 3,
    });
    expect(r.level).toBe("AMAN");
    expect(r.score).toBeLessThan(25);
    expect(r.factors.length).toBe(0);
  });

  it("returns KRITIS for student with multiple risk factors", () => {
    const r = evaluateRisk({
      avgKnowledge: 45, scoreVolatility: 25, totalAbsence: 30,
      scoreDelta: -20, semesterCount: 4, achievementCount: 0,
    });
    expect(r.level).toBe("KRITIS");
    expect(r.score).toBeGreaterThanOrEqual(50);
    expect(r.factors.length).toBeGreaterThanOrEqual(3);
  });

  it("returns WASPADA for moderate risk", () => {
    // avgKnowledge=55 (below 70) + totalAbsence=20 across 2 semesters + no achievement
    const r = evaluateRisk({
      avgKnowledge: 55, scoreVolatility: 10, totalAbsence: 20,
      scoreDelta: -5, semesterCount: 2, achievementCount: 0,
    });
    expect(r.level).toBe("WASPADA");
    expect(r.score).toBeGreaterThanOrEqual(25);
    expect(r.score).toBeLessThan(50);
  });

  it("handles no data gracefully", () => {
    const r = evaluateRisk({
      avgKnowledge: 0, scoreVolatility: 0, totalAbsence: 0,
      scoreDelta: 0, semesterCount: 0, achievementCount: 0,
    });
    expect(r.level).toBe("AMAN");
    expect(r.score).toBe(0);
  });

  it("factors have contribution weights", () => {
    const r = evaluateRisk({
      avgKnowledge: 50, scoreVolatility: 20, totalAbsence: 15,
      scoreDelta: -15, semesterCount: 3, achievementCount: 0,
    });
    for (const f of r.factors) {
      expect(f.contribution).toBeGreaterThan(0);
      expect(f.contribution).toBeLessThanOrEqual(1);
    }
  });
});

describe("ModelEvaluator — analyzeFeatures", () => {
  it("handles empty input", () => {
    const result = analyzeFeatures([]);
    expect(result.nStudents).toBe(0);
    expect(result.features).toHaveLength(0);
  });

  it("computes stats for sample features", () => {
    const result = analyzeFeatures([
      { studentId: "1", avgKnowledge: 80, avgSkills: 75, scoreVolatility: 10, scoreDelta: 5, totalAbsence: 3, absenceTrend: 0, achievementCount: 2, semesterCount: 3 },
      { studentId: "2", avgKnowledge: 90, avgSkills: 85, scoreVolatility: 5, scoreDelta: 8, totalAbsence: 0, absenceTrend: 0, achievementCount: 5, semesterCount: 4 },
      { studentId: "3", avgKnowledge: 70, avgSkills: 68, scoreVolatility: 15, scoreDelta: -3, totalAbsence: 10, absenceTrend: 1, achievementCount: 0, semesterCount: 2 },
    ]);
    expect(result.nStudents).toBe(3);
    expect(result.dataQuality.warnings.length).toBeGreaterThanOrEqual(0);
    const knowledge = result.features.find((f) => f.name === "avgKnowledge");
    expect(knowledge).toBeDefined();
    expect(knowledge!.mean).toBe(80);
  });

  it("emits data quality warnings for missing data", () => {
    const result = analyzeFeatures([
      { studentId: "1", avgKnowledge: 0, avgSkills: 0, scoreVolatility: 0, scoreDelta: 0, totalAbsence: 0, absenceTrend: 0, achievementCount: 0, semesterCount: 0 },
    ]);
    expect(result.dataQuality.warnings.length).toBeGreaterThan(0);
  });
});

describe("ModelEvaluator — analyzeRiskDistribution", () => {
  it("handles empty input", () => {
    const r = analyzeRiskDistribution([]);
    expect(r.total).toBe(0);
  });

  it("computes distribution over sample students", () => {
    const r = analyzeRiskDistribution([
      { studentId: "1", avgKnowledge: 85, avgSkills: 80, scoreVolatility: 5, scoreDelta: 3, totalAbsence: 1, absenceTrend: 0, achievementCount: 4, semesterCount: 4 },
      { studentId: "2", avgKnowledge: 55, avgSkills: 50, scoreVolatility: 20, scoreDelta: -15, totalAbsence: 25, absenceTrend: 2, achievementCount: 0, semesterCount: 3 },
    ]);
    expect(r.total).toBe(2);
    expect(r.aman + r.waspada + r.kritis).toBe(2);
    expect(r.avgScore).toBeGreaterThan(0);
  });
});

describe("LinearRegression — trainLinearRegression", () => {
  it("computes real R²", () => {
    // Perfect linear data: y = 10x + 5
    const x = [0, 1, 2, 3, 4];
    const y = [5, 15, 25, 35, 45];
    const r = trainLinearRegression(x, y);
    expect(r.slope).toBe(10);
    expect(r.intercept).toBe(5);
    expect(r.rSquared).toBeCloseTo(1, 2); // perfect fit
  });

  it("handles single data point", () => {
    const r = trainLinearRegression([0], [50]);
    expect(r.rSquared).toBe(0);
  });

  it("predicts within [0, 100] range", () => {
    const r = trainLinearRegression([0, 1], [95, 100]);
    const pred = r.predict(10);
    expect(pred).toBeGreaterThanOrEqual(0);
    expect(pred).toBeLessThanOrEqual(100);
  });

  it("flat data gives zero R²", () => {
    const r = trainLinearRegression([0, 1, 2], [75, 75, 75]);
    expect(r.slope).toBe(0);
    expect(r.rSquared).toBe(0);
  });
});
