import { describe, expect, it, beforeAll } from "bun:test";
import { cleanDb, prisma } from "./setup";
import * as service from "../src/modules/ai/ai-summary.service";

describe("AI Summary Service", () => {
  let semesterRecordId: string;

  beforeAll(async () => {
    await cleanDb();
    const year = await prisma.academicYear.create({ data: { year: "2025/2026" } });
    const cls = await prisma.class.create({ data: { name: "Kelas 5A", academicYearId: year.id } });
    const student = await prisma.student.create({ data: { name: "AI Test", classId: cls.id, nis: "AI1", nisn: "AI001", gender: "L" } });
    const user = await prisma.user.create({ data: { username: "g-ai", password: "x", name: "G AI", role: "GURU" } });
    const rec = await prisma.semesterRecord.create({ data: { studentId: student.id, academicYearId: year.id, semester: 1, createdById: user.id } });
    semesterRecordId = rec.id;
  });

  describe("getBySemesterRecord", () => {
    it("returns empty array when no summaries exist", async () => {
      const summaries = await service.getBySemesterRecord(semesterRecordId);
      expect(summaries).toEqual([]);
    });

    it("returns all summaries for a semester record", async () => {
      await prisma.aiSummary.create({
        data: { semesterRecordId, summaryType: "STUDENT_SUMMARY", content: "Summary 1", isFinal: false, version: 1 },
      });
      await prisma.aiSummary.create({
        data: { semesterRecordId, summaryType: "STUDENT_SUMMARY", content: "Summary 2", isFinal: false, version: 2 },
      });
      await prisma.aiSummary.create({
        data: { semesterRecordId, summaryType: "DRAFT_DESCRIPTION", content: "Draft 1", isFinal: true, version: 1 },
      });

      const summaries = await service.getBySemesterRecord(semesterRecordId);
      expect(summaries.length).toBe(3);
    });

    it("orders by version descending", async () => {
      const summaries = await service.getBySemesterRecord(semesterRecordId);
      expect(summaries.length).toBeGreaterThanOrEqual(2);
      for (let i = 1; i < summaries.length; i++) {
        expect(summaries[i - 1].version >= summaries[i].version).toBe(true);
      }
    });
  });

  describe("update", () => {
    it("updates isFinal flag", async () => {
      const summary = await prisma.aiSummary.create({
        data: { semesterRecordId, summaryType: "STUDENT_SUMMARY", content: "To finalize", isFinal: false, version: 10 },
      });
      const updated = await service.update(summary.id, { isFinal: true });
      expect(updated.isFinal).toBe(true);
    });

    it("updates content", async () => {
      const summary = await prisma.aiSummary.create({
        data: { semesterRecordId, summaryType: "STUDENT_SUMMARY", content: "Old content", isFinal: false, version: 11 },
      });
      const updated = await service.update(summary.id, { content: "New content" });
      expect(updated.content).toBe("New content");
    });

    it("updates both isFinal and content simultaneously", async () => {
      const summary = await prisma.aiSummary.create({
        data: { semesterRecordId, summaryType: "STUDENT_SUMMARY", content: "Combined", isFinal: false, version: 12 },
      });
      const updated = await service.update(summary.id, { isFinal: true, content: "Updated combined" });
      expect(updated.isFinal).toBe(true);
      expect(updated.content).toBe("Updated combined");
    });

    it("throws NotFoundError for non-existent summary", async () => {
      expect(service.update("nonexistent", { isFinal: true })).rejects.toThrow();
    });
  });

  describe("remove", () => {
    it("deletes AI summary", async () => {
      const summary = await prisma.aiSummary.create({
        data: { semesterRecordId, summaryType: "STUDENT_SUMMARY", content: "To delete", isFinal: false, version: 20 },
      });
      await service.remove(summary.id);
      const found = await prisma.aiSummary.findUnique({ where: { id: summary.id } });
      expect(found).toBeNull();
    });

    it("throws NotFoundError for non-existent summary", async () => {
      expect(service.remove("nonexistent")).rejects.toThrow();
    });
  });
});
