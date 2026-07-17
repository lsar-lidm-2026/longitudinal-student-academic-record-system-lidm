import { describe, expect, it, beforeAll } from "bun:test";
import { cleanDb, prisma } from "./setup";
import * as service from "../src/modules/subject-scores/subject-score.service";

describe("SubjectScore Upsert", () => {
  let recordId: string;

  beforeAll(async () => {
    await cleanDb();
    const year = await prisma.academicYear.create({ data: { year: "2025/2026" } });
    const cls = await prisma.class.create({ data: { name: "Kelas 5A", academicYearId: year.id } });
    const student = await prisma.student.create({ data: { name: "A", classId: cls.id, nis: "1", nisn: "1", gender: "L" } });
    const user = await prisma.user.create({ data: { username: "g", password: "x", name: "G", role: "GURU" } });
    const rec = await prisma.semesterRecord.create({ data: { studentId: student.id, academicYearId: year.id, semester: 1, createdById: user.id } });
    recordId = rec.id;
  });

  it("creates new score", async () => {
    const s = await service.upsert(recordId, { subjectName: "Matematika", knowledgeScore: 85, skillsScore: 80 });
    expect(s.subjectName).toBe("Matematika");
    expect(s.knowledgeScore).toBe(85);
  });

  it("updates existing score (upsert)", async () => {
    const s = await service.upsert(recordId, { subjectName: "Matematika", knowledgeScore: 90, skillsScore: 85 });
    expect(s.knowledgeScore).toBe(90);
  });

  it("stores separate scores for different subjects", async () => {
    const mtk = await service.upsert(recordId, { subjectName: "MTK", knowledgeScore: 85, skillsScore: 80 });
    const ipa = await service.upsert(recordId, { subjectName: "IPA", knowledgeScore: 90, skillsScore: 88 });
    expect(mtk.id).not.toBe(ipa.id);
  });
});
