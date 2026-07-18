import { describe, expect, it, beforeAll } from "bun:test";
import { cleanDb, prisma } from "./setup";
import * as service from "../src/modules/classes/class.service";

describe("Class Service", () => {
  beforeAll(async () => { await cleanDb(); });

  describe("list", () => {
    it("returns empty when no classes", async () => {
      const list = await service.list();
      expect(list).toEqual([]);
    });

    it("returns all classes with relations", async () => {
      const year = await prisma.academicYear.create({ data: { year: "2025/2026" } });
      const user = await prisma.user.create({ data: { username: "g-list", password: "x", name: "G", role: "GURU" } });
      await prisma.class.create({ data: { name: "Kelas 1A", academicYearId: year.id, homeroomTeacherId: user.id } });
      await prisma.class.create({ data: { name: "Kelas 1B", academicYearId: year.id } });
      const list = await service.list();
      expect(list.length).toBe(2);
      // Each item should include academicYear, homeroomTeacher, _count
      expect(list[0].academicYear).toBeDefined();
      expect(list[0].homeroomTeacher).toBeDefined();
      expect(list[0]._count).toBeDefined();
    });

    it("orders by year descending then name ascending", async () => {
      const year1 = await prisma.academicYear.create({ data: { year: "2024/2025" } });
      const year2 = await prisma.academicYear.create({ data: { year: "2025/2026" } });
      await prisma.class.create({ data: { name: "Kelas B", academicYearId: year1.id } });
      await prisma.class.create({ data: { name: "Kelas A", academicYearId: year2.id } });
      await prisma.class.create({ data: { name: "Kelas C", academicYearId: year1.id } });
      const list = await service.list();
      // Most recent year first, then alphabetically within year
      expect(list[0].academicYear.year >= list[1]!.academicYear.year).toBe(true);
    });
  });

  describe("getById", () => {
    it("returns class by id with all relations", async () => {
      const year = await prisma.academicYear.create({ data: { year: "2025/2026" } });
      const user = await prisma.user.create({ data: { username: "g-gbi", password: "x", name: "Guru X", role: "GURU" } });
      const cls = await prisma.class.create({ data: { name: "Kelas 5A", academicYearId: year.id, homeroomTeacherId: user.id } });
      const found = await service.getById(cls.id);
      expect(found.name).toBe("Kelas 5A");
      expect(found.homeroomTeacher?.name).toBe("Guru X");
      expect(found.academicYear.year).toBe("2025/2026");
    });

    it("throws NotFoundError for non-existent id", async () => {
      expect(service.getById("nonexistent")).rejects.toThrow();
    });

    it("returns null homeroomTeacher when not assigned", async () => {
      const year = await prisma.academicYear.create({ data: { year: "2026/2027" } });
      const cls = await prisma.class.create({ data: { name: "Kelas 6A", academicYearId: year.id } });
      const found = await service.getById(cls.id);
      expect(found.homeroomTeacher).toBeNull();
    });
  });

  describe("create", () => {
    it("creates a class", async () => {
      const year = await prisma.academicYear.create({ data: { year: "2025/2026" } });
      const cls = await service.create({ name: "Kelas 6A", academicYearId: year.id });
      expect(cls.name).toBe("Kelas 6A");
    });

    it("rejects duplicate class name in same year", async () => {
      const year = await prisma.academicYear.create({ data: { year: "2027/2028" } });
      await service.create({ name: "Kelas 1A", academicYearId: year.id });
      expect(service.create({ name: "Kelas 1A", academicYearId: year.id })).rejects.toThrow();
    });

    it("allows same class name in different year", async () => {
      const y1 = await prisma.academicYear.create({ data: { year: "2030/2031" } });
      const y2 = await prisma.academicYear.create({ data: { year: "2031/2032" } });
      await service.create({ name: "Kelas 1A", academicYearId: y1.id });
      const cls2 = await service.create({ name: "Kelas 1A", academicYearId: y2.id });
      expect(cls2.name).toBe("Kelas 1A");
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
      expect(students[0].name).toBe("S1"); // sorted by name asc
    });

    it("returns students sorted by name", async () => {
      const year = await prisma.academicYear.create({ data: { year: "2025/2026" } });
      const cls = await prisma.class.create({ data: { name: "Kelas 5B", academicYearId: year.id } });
      await prisma.student.create({ data: { name: "Z", classId: cls.id, nis: "2001", nisn: "002001", gender: "L" } });
      await prisma.student.create({ data: { name: "A", classId: cls.id, nis: "2002", nisn: "002002", gender: "P" } });
      const students = await service.getStudents(cls.id);
      expect(students[0].name).toBe("A");
      expect(students[1].name).toBe("Z");
    });

    it("returns empty array for class with no students", async () => {
      const year = await prisma.academicYear.create({ data: { year: "2025/2026" } });
      const cls = await prisma.class.create({ data: { name: "Empty Class", academicYearId: year.id } });
      const students = await service.getStudents(cls.id);
      expect(students).toEqual([]);
    });
  });

  describe("assignTeacher", () => {
    it("assigns homeroom teacher and creates audit log", async () => {
      const year = await prisma.academicYear.create({ data: { year: "2025/2026" } });
      const admin = await prisma.user.create({ data: { username: "admin-at", password: "x", name: "Admin", role: "ADMINISTRATOR" } });
      const teacher = await prisma.user.create({ data: { username: "guru-at", password: "x", name: "Guru", role: "GURU" } });
      const cls = await prisma.class.create({ data: { name: "Kelas 5A", academicYearId: year.id } });

      const updated = await service.assignTeacher(cls.id, teacher.id, admin.id);
      expect(updated.homeroomTeacherId).toBe(teacher.id);

      // Verify audit log
      const logs = await prisma.classAuditLog.findMany({ where: { classId: cls.id } });
      expect(logs.length).toBe(1);
      expect(logs[0].newTeacherId).toBe(teacher.id);
      expect(logs[0].changedById).toBe(admin.id);
      expect(logs[0].previousTeacherId).toBeNull();
    });

    it("replaces existing teacher and logs previous", async () => {
      const year = await prisma.academicYear.create({ data: { year: "2025/2026" } });
      const admin = await prisma.user.create({ data: { username: "admin-at2", password: "x", name: "Admin", role: "ADMINISTRATOR" } });
      const teacher1 = await prisma.user.create({ data: { username: "guru-at1", password: "x", name: "Guru 1", role: "GURU" } });
      const teacher2 = await prisma.user.create({ data: { username: "guru-at2", password: "x", name: "Guru 2", role: "GURU" } });
      const cls = await prisma.class.create({ data: { name: "Kelas 5B", academicYearId: year.id, homeroomTeacherId: teacher1.id } });

      await service.assignTeacher(cls.id, teacher2.id, admin.id);
      const logs = await prisma.classAuditLog.findMany({ where: { classId: cls.id }, orderBy: { changedAt: "asc" } });
      expect(logs.length).toBe(1);
      expect(logs[0].previousTeacherId).toBe(teacher1.id);
      expect(logs[0].newTeacherId).toBe(teacher2.id);
    });

    it("throws NotFoundError for non-existent class", async () => {
      expect(service.assignTeacher("nonexistent", "teacher-id", "admin-id")).rejects.toThrow();
    });
  });
});
