import { describe, expect, it, beforeAll } from "bun:test";
import { cleanDb, prisma } from "./setup";
import * as service from "../src/modules/dashboard/dashboard.service";

describe("Dashboard Service", () => {
  beforeAll(async () => { await cleanDb(); });

  describe("ADMINISTRATOR summary", () => {
    it("returns counts of students and classes", async () => {
      const year = await prisma.academicYear.create({ data: { year: "2025/2026", isActive: true } });
      const c1 = await prisma.class.create({ data: { name: "Kelas 5A", academicYearId: year.id } });
      const c2 = await prisma.class.create({ data: { name: "Kelas 5B", academicYearId: year.id } });
      await prisma.student.create({ data: { name: "S1", classId: c1.id, nis: "1", nisn: "1", gender: "L" } });
      await prisma.student.create({ data: { name: "S2", classId: c2.id, nis: "2", nisn: "2", gender: "P" } });
      const summary = await service.getSummary("admin-id", "ADMINISTRATOR");
      expect(summary.totalStudents).toBe(2);
      expect(summary.totalClasses).toBe(2);
      expect(summary.activeYear).toBe("2025/2026");
    });
  });

  describe("GURU summary", () => {
    it("returns managed classes", async () => {
      const teacherId = "teacher-uuid";
      await prisma.user.create({ data: { id: teacherId, username: "guru", password: "x", name: "Guru", role: "GURU" } });
      const year = await prisma.academicYear.create({ data: { year: "2025/2026" } });
      await prisma.class.create({ data: { name: "Kelas 5A", academicYearId: year.id, homeroomTeacherId: teacherId } });
      const summary = await service.getSummary(teacherId, "GURU");
      expect(summary.managedClasses.length).toBe(1);
    });
  });

  describe("OPERATOR summary", () => {
    it("returns basic counts", async () => {
      const year = await prisma.academicYear.create({ data: { year: "2025/2026" } });
      const cls = await prisma.class.create({ data: { name: "Kelas 5A", academicYearId: year.id } });
      await prisma.student.create({ data: { name: "S1", classId: cls.id, nis: "1", nisn: "1", gender: "L" } });
      const summary = await service.getSummary("op-id", "OPERATOR_SEKOLAH");
      expect(summary.totalStudents).toBe(1);
    });
  });
});
