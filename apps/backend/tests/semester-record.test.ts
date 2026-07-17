import { describe, expect, it, beforeAll } from "bun:test";
import { cleanDb, prisma } from "./setup";
import * as service from "../src/modules/semester-records/semester-record.service";

describe("SemesterRecord Service", () => {
  let studentId: string, yearId: string, userId: string;

  beforeAll(async () => {
    await cleanDb();
    const year = await prisma.academicYear.create({ data: { year: "2025/2026" } });
    yearId = year.id;
    const cls = await prisma.class.create({ data: { name: "Kelas 5A", academicYearId: year.id } });
    const student = await prisma.student.create({ data: { name: "Ahmad", classId: cls.id, nis: "1001", nisn: "001001", gender: "L" } });
    studentId = student.id;
    const user = await prisma.user.create({ data: { username: "guru", password: "x", name: "Guru", role: "GURU" } });
    userId = user.id;
  });

  describe("create", () => {
    it("creates semester record", async () => {
      const rec = await service.create({ studentId, academicYearId: yearId, semester: 1, createdById: userId });
      expect(rec.semester).toBe(1);
    });

    it("rejects duplicate student+year+semester", async () => {
      expect(service.create({ studentId, academicYearId: yearId, semester: 1, createdById: userId })).rejects.toThrow();
    });

    it("allows different semester", async () => {
      const rec = await service.create({ studentId, academicYearId: yearId, semester: 2, createdById: userId });
      expect(rec.semester).toBe(2);
    });
  });

  describe("listByStudent", () => {
    it("returns student records", async () => {
      const records = await service.listByStudent(studentId);
      expect(records.length).toBe(2); // semester 1 and 2 created above
    });
  });

  describe("getById", () => {
    it("returns record with relations", async () => {
      const records = await service.listByStudent(studentId);
      if (records.length > 0) {
        const found = await service.getById(records[0].id);
        expect(found).toBeDefined();
        expect(found.student.name).toBe("Ahmad");
      }
    });
  });
});
