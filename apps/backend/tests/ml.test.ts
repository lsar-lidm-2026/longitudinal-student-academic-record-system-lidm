import { describe, expect, it, beforeAll } from "bun:test";
import { cleanDb, prisma } from "./setup";
import { resetCache } from "../src/modules/ml/trainer";
import { computeFeatures } from "../src/modules/ml/features";
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
    expect("hasRiskTree" in models).toBe(true);
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
