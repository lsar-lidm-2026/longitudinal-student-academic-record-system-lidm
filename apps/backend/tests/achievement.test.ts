import { describe, expect, it, beforeAll } from "bun:test";
import { cleanDb, prisma } from "./setup";
import * as service from "../src/modules/achievements/achievement.service";

describe("Achievement Service", () => {
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

  describe("create", () => {
    it("creates achievement", async () => {
      const a = await service.create({ semesterRecordId: recordId, title: "Juara 1", type: "Akademik" });
      expect(a.title).toBe("Juara 1");
      expect(a.type).toBe("Akademik");
    });

    it("creates achievement with description", async () => {
      const a = await service.create({
        semesterRecordId: recordId,
        title: "Juara 2",
        type: "Non-Akademik",
        description: "Juara lomba menyanyi tingkat kota",
      });
      expect(a.description).toBe("Juara lomba menyanyi tingkat kota");
    });

    it("stores multiple achievements", async () => {
      await service.create({ semesterRecordId: recordId, title: "A1", type: "Akademik" });
      await service.create({ semesterRecordId: recordId, title: "A2", type: "Non-Akademik" });
      const all = await prisma.achievement.findMany({ where: { semesterRecordId: recordId } });
      expect(all.length).toBe(4); // 2 from previous tests + 2 from this one
    });

    it("throws NotFoundError for non-existent semester record", async () => {
      expect(service.create({ semesterRecordId: "nonexistent", title: "X", type: "Akademik" })).rejects.toThrow();
    });
  });

  describe("update", () => {
    it("updates achievement title", async () => {
      const a = await service.create({ semesterRecordId: recordId, title: "Original", type: "Akademik" });
      const updated = await service.update(a.id, { title: "Updated Title" });
      expect(updated.title).toBe("Updated Title");
    });

    it("updates achievement type", async () => {
      const a = await service.create({ semesterRecordId: recordId, title: "TypeTest", type: "Akademik" });
      const updated = await service.update(a.id, { type: "Non-Akademik" });
      expect(updated.type).toBe("Non-Akademik");
    });

    it("updates achievement description", async () => {
      const a = await service.create({ semesterRecordId: recordId, title: "DescTest", type: "Akademik" });
      const updated = await service.update(a.id, { description: "New description" });
      expect(updated.description).toBe("New description");
    });

    it("clears description by updating with empty string", async () => {
      const a = await service.create({ semesterRecordId: recordId, title: "ClearDesc", type: "Akademik", description: "Old desc" });
      const updated = await service.update(a.id, { description: "" });
      expect(updated.description).toBe("");
    });

    it("throws NotFoundError for non-existent achievement", async () => {
      expect(service.update("nonexistent", { title: "X" })).rejects.toThrow();
    });
  });

  describe("remove", () => {
    it("deletes achievement", async () => {
      const a = await service.create({ semesterRecordId: recordId, title: "ToDelete", type: "Akademik" });
      await service.remove(a.id);
      const found = await prisma.achievement.findUnique({ where: { id: a.id } });
      expect(found).toBeNull();
    });

    it("throws NotFoundError for non-existent achievement", async () => {
      expect(service.remove("nonexistent")).rejects.toThrow();
    });

    it("cascades delete when semester record is deleted", async () => {
      const year = await prisma.academicYear.create({ data: { year: "2026/2027" } });
      const cls = await prisma.class.create({ data: { name: "Kelas 6A", academicYearId: year.id } });
      const student = await prisma.student.create({ data: { name: "CascadeTest", classId: cls.id, nis: "C-1", nisn: "CN-1", gender: "L" } });
      const user = await prisma.user.create({ data: { username: "g2", password: "x", name: "G2", role: "GURU" } });
      const rec = await prisma.semesterRecord.create({ data: { studentId: student.id, academicYearId: year.id, semester: 1, createdById: user.id } });
      await service.create({ semesterRecordId: rec.id, title: "CascadeAch", type: "Akademik" });

      await prisma.semesterRecord.delete({ where: { id: rec.id } });
      const achievements = await prisma.achievement.findMany({ where: { semesterRecordId: rec.id } });
      expect(achievements.length).toBe(0);
    });
  });
});
