import { describe, expect, it, beforeAll } from "bun:test";
import { cleanDb, prisma } from "./setup";
import * as service from "../src/modules/classes/class.service";

describe("Class Service", () => {
  beforeAll(async () => { await cleanDb(); });

  describe("list", () => {
    it("returns all classes", async () => {
      const year = await prisma.academicYear.create({ data: { year: "2025/2026" } });
      await prisma.class.create({ data: { name: "Kelas 1A", academicYearId: year.id } });
      await prisma.class.create({ data: { name: "Kelas 1B", academicYearId: year.id } });
      const list = await service.list();
      expect(list.length).toBe(2);
    });

    it("returns empty when no classes", async () => {
      await cleanDb();
      const list = await service.list();
      expect(list).toEqual([]);
    });
  });

  describe("getById", () => {
    it("returns class by id", async () => {
      const year = await prisma.academicYear.create({ data: { year: "2025/2026" } });
      const cls = await prisma.class.create({ data: { name: "Kelas 5A", academicYearId: year.id } });
      const found = await service.getById(cls.id);
      expect(found.name).toBe("Kelas 5A");
    });
  });

  describe("create", () => {
    it("creates a class", async () => {
      const year = await prisma.academicYear.create({ data: { year: "2025/2026" } });
      const cls = await service.create({ name: "Kelas 6A", academicYearId: year.id });
      expect(cls.name).toBe("Kelas 6A");
    });
  });

  describe("getStudents", () => {
    it("returns students for a class", async () => {
      const year = await prisma.academicYear.create({ data: { year: "2025/2026" } });
      const cls = await prisma.class.create({ data: { name: "Kelas 5A", academicYearId: year.id } });
      await prisma.student.create({ data: { name: "S1", classId: cls.id, nis: "1001", nisn: "001001", gender: "L" } });
      await prisma.student.create({ data: { name: "S2", classId: cls.id, nis: "1002", nisn: "001002", gender: "P" } });
      const students = await service.getStudents(cls.id);
      expect(students.length).toBe(2);
    });
  });

  describe("assignTeacher", () => {
    it("assigns homeroom teacher and creates audit log", async () => {
      const year = await prisma.academicYear.create({ data: { year: "2025/2026" } });
      const admin = await prisma.user.create({ data: { username: "admin", password: "x", name: "Admin", role: "ADMINISTRATOR" } });
      const teacher = await prisma.user.create({ data: { username: "guru", password: "x", name: "Guru", role: "GURU" } });
      const cls = await prisma.class.create({ data: { name: "Kelas 5A", academicYearId: year.id } });
      const updated = await service.assignTeacher(cls.id, teacher.id, admin.id);
      expect(updated.homeroomTeacherId).toBe(teacher.id);
    });
  });
});
