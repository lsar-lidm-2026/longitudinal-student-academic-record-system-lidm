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

  describe("upsert", () => {
    it("creates new score", async () => {
      const s = await service.upsert(recordId, { subjectName: "Matematika", knowledgeScore: 85, skillsScore: 80 });
      expect(s.subjectName).toBe("Matematika");
      expect(s.knowledgeScore).toBe(85);
      expect(s.skillsScore).toBe(80);
    });

    it("updates existing score (upsert)", async () => {
      const s = await service.upsert(recordId, { subjectName: "Matematika", knowledgeScore: 90, skillsScore: 85 });
      expect(s.knowledgeScore).toBe(90);
      expect(s.skillsScore).toBe(85);
    });

    it("stores separate scores for different subjects", async () => {
      const mtk = await service.upsert(recordId, { subjectName: "MTK", knowledgeScore: 85, skillsScore: 80 });
      const ipa = await service.upsert(recordId, { subjectName: "IPA", knowledgeScore: 90, skillsScore: 88 });
      expect(mtk.id).not.toBe(ipa.id);
    });

    it("stores notes when provided", async () => {
      const s = await service.upsert(recordId, {
        subjectName: "IPS",
        knowledgeScore: 78,
        skillsScore: 75,
        notes: "Perlu perhatian pada bagian geografi",
      });
      expect(s.notes).toBe("Perlu perhatian pada bagian geografi");
    });

    it("handles maximum scores", async () => {
      const s = await service.upsert(recordId, { subjectName: "Perfect", knowledgeScore: 100, skillsScore: 100 });
      expect(s.knowledgeScore).toBe(100);
      expect(s.skillsScore).toBe(100);
    });

    it("handles minimum scores", async () => {
      const s = await service.upsert(recordId, { subjectName: "MinTest", knowledgeScore: 0, skillsScore: 0 });
      expect(s.knowledgeScore).toBe(0);
      expect(s.skillsScore).toBe(0);
    });

    it("throws NotFoundError for non-existent semester record", async () => {
      expect(service.upsert("nonexistent", { subjectName: "X", knowledgeScore: 80, skillsScore: 75 })).rejects.toThrow();
    });
  });

  describe("remove", () => {
    it("deletes subject score", async () => {
      const s = await service.upsert(recordId, { subjectName: "DeleteTest", knowledgeScore: 80, skillsScore: 75 });
      await service.remove(s.id);
      const found = await prisma.subjectScore.findUnique({ where: { id: s.id } });
      expect(found).toBeNull();
    });

    it("throws NotFoundError for non-existent score", async () => {
      expect(service.remove("nonexistent")).rejects.toThrow();
    });

    it("cascades delete when semester record is deleted", async () => {
      const year = await prisma.academicYear.create({ data: { year: "2026/2027" } });
      const cls = await prisma.class.create({ data: { name: "Kelas 6A", academicYearId: year.id } });
      const student = await prisma.student.create({ data: { name: "CascadeScore", classId: cls.id, nis: "CS-1", nisn: "CSN-1", gender: "L" } });
      const user = await prisma.user.create({ data: { username: "g3", password: "x", name: "G3", role: "GURU" } });
      const rec = await prisma.semesterRecord.create({ data: { studentId: student.id, academicYearId: year.id, semester: 1, createdById: user.id } });
      await service.upsert(rec.id, { subjectName: "Test", knowledgeScore: 80, skillsScore: 75 });

      await prisma.semesterRecord.delete({ where: { id: rec.id } });
      const scores = await prisma.subjectScore.findMany({ where: { semesterRecordId: rec.id } });
      expect(scores.length).toBe(0);
    });
  });
});
