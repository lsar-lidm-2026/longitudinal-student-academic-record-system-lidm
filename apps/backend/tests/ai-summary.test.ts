import { describe, expect, it } from "bun:test";
import { cleanDb, prisma } from "./setup";
import * as service from "../src/modules/ai/ai-summary.service";

// Each test manages its own data independently
describe("AI Summary Service", () => {
  async function seedData() {
    await cleanDb();
    const year = await prisma.academicYear.create({ data: { year: "AIS-2025/2026" } });
    const cls = await prisma.class.create({ data: { name: "Kelas 5A", academicYearId: year.id } });
    const student = await prisma.student.create({ data: { name: "AI Test", classId: cls.id, nis: "AI1", nisn: "AI001", gender: "L" } });
    const user = await prisma.user.create({ data: { username: "g-ai", password: "x", name: "G AI", role: "GURU" } });
    const rec = await prisma.semesterRecord.create({ data: { studentId: student.id, academicYearId: year.id, semester: 1, createdById: user.id } });
    return rec.id;
  }

  describe("getBySemesterRecord", () => {
    it("returns empty array when no summaries exist", async () => {
      const recId = await seedData();
      expect(await service.getBySemesterRecord(recId)).toEqual([]);
    });

    it("returns all summaries for a semester record", async () => {
      const recId = await seedData();
      await prisma.aiSummary.create({ data: { semesterRecordId: recId, summaryType: "STUDENT_SUMMARY", content: "S1", isFinal: false, version: 1 } });
      await prisma.aiSummary.create({ data: { semesterRecordId: recId, summaryType: "STUDENT_SUMMARY", content: "S2", isFinal: false, version: 2 } });
      await prisma.aiSummary.create({ data: { semesterRecordId: recId, summaryType: "DRAFT_DESCRIPTION", content: "D1", isFinal: true, version: 1 } });
      expect((await service.getBySemesterRecord(recId)).length).toBe(3);
    });

    it("orders by version descending", async () => {
      const recId = await seedData();
      await prisma.aiSummary.create({ data: { semesterRecordId: recId, summaryType: "STUDENT_SUMMARY", content: "S1", isFinal: false, version: 1 } });
      await prisma.aiSummary.create({ data: { semesterRecordId: recId, summaryType: "STUDENT_SUMMARY", content: "S2", isFinal: false, version: 2 } });
      const summaries = await service.getBySemesterRecord(recId);
      expect(summaries[0].version >= summaries[1].version).toBe(true);
    });
  });

  describe("update", () => {
    it("updates isFinal flag", async () => {
      const recId = await seedData();
      const s = await prisma.aiSummary.create({ data: { semesterRecordId: recId, summaryType: "STUDENT_SUMMARY", content: "Tf", isFinal: false, version: 10 } });
      expect((await service.update(s.id, { isFinal: true })).isFinal).toBe(true);
    });

    it("updates content", async () => {
      const recId = await seedData();
      const s = await prisma.aiSummary.create({ data: { semesterRecordId: recId, summaryType: "STUDENT_SUMMARY", content: "Old", isFinal: false, version: 11 } });
      expect((await service.update(s.id, { content: "New" })).content).toBe("New");
    });

    it("updates both isFinal and content simultaneously", async () => {
      const recId = await seedData();
      const s = await prisma.aiSummary.create({ data: { semesterRecordId: recId, summaryType: "STUDENT_SUMMARY", content: "C", isFinal: false, version: 12 } });
      const updated = await service.update(s.id, { isFinal: true, content: "Updated" });
      expect(updated.isFinal).toBe(true);
      expect(updated.content).toBe("Updated");
    });

    it("throws NotFoundError for non-existent summary", async () => {
      expect(service.update("nonexistent", { isFinal: true })).rejects.toThrow();
    });
  });

  describe("remove", () => {
    it("deletes AI summary", async () => {
      const recId = await seedData();
      const s = await prisma.aiSummary.create({ data: { semesterRecordId: recId, summaryType: "STUDENT_SUMMARY", content: "Del", isFinal: false, version: 20 } });
      await service.remove(s.id);
      expect(await prisma.aiSummary.findUnique({ where: { id: s.id } })).toBeNull();
    });

    it("throws NotFoundError for non-existent summary", async () => {
      expect(service.remove("nonexistent")).rejects.toThrow();
    });
  });
});
