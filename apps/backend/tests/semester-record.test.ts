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
      expect(rec.studentId).toBe(studentId);
    });

    it("rejects duplicate student+year+semester", async () => {
      expect(service.create({ studentId, academicYearId: yearId, semester: 1, createdById: userId })).rejects.toThrow();
    });

    it("allows different semester", async () => {
      const rec = await service.create({ studentId, academicYearId: yearId, semester: 2, createdById: userId });
      expect(rec.semester).toBe(2);
    });

    it("allows same student different year", async () => {
      const year2 = await prisma.academicYear.create({ data: { year: "2024/2025" } });
      const rec = await service.create({ studentId, academicYearId: year2.id, semester: 1, createdById: userId });
      expect(rec.semester).toBe(1);
      expect(rec.academicYearId).toBe(year2.id);
    });

    it("returns related subjectScores, attendance, achievements, healthRecord as empty defaults", async () => {
      const year = await prisma.academicYear.create({ data: { year: "2027/2028" } });
      const rec = await service.create({ studentId, academicYearId: year.id, semester: 1, createdById: userId });
      expect(rec.subjectScores).toEqual([]);
      expect(rec.attendance).toBeNull();
      expect(rec.achievements).toEqual([]);
      expect(rec.healthRecord).toBeNull();
    });

    it("throws when student does not exist", async () => {
      const year = await prisma.academicYear.create({ data: { year: "2028/2029" } });
      expect(service.create({ studentId: "nonexistent", academicYearId: year.id, semester: 1, createdById: userId })).rejects.toThrow();
    });
  });

  describe("listByStudent", () => {
    it("returns student records in chronological order", async () => {
      const records = await service.listByStudent(studentId);
      // Should have records from various years created above
      expect(records.length).toBeGreaterThanOrEqual(2);
      // Check ordering: by year asc, then semester asc
      for (let i = 1; i < records.length; i++) {
        const prev = records[i - 1]!;
        const curr = records[i]!;
        const prevSort = prev.academicYear.year + String(prev.semester).padStart(2, "0");
        const currSort = curr.academicYear.year + String(curr.semester).padStart(2, "0");
        expect(prevSort <= currSort).toBe(true);
      }
    });

    it("returns empty array for student with no records", async () => {
      const cls = await prisma.class.create({ data: { name: "Kelas 6A", academicYearId: yearId } });
      const student = await prisma.student.create({ data: { name: "No Record", classId: cls.id, nis: "NR1", nisn: "NR001", gender: "L" } });
      const records = await service.listByStudent(student.id);
      expect(records).toEqual([]);
    });

    it("includes full relations in each record", async () => {
      const records = await service.listByStudent(studentId);
      if (records.length > 0) {
        expect(records[0].academicYear).toBeDefined();
        expect(records[0].academicYear.year).toBeDefined();
        expect(Array.isArray(records[0].subjectScores)).toBe(true);
      }
    });
  });

  describe("getById", () => {
    it("returns record with all relations", async () => {
      const records = await service.listByStudent(studentId);
      if (records.length > 0) {
        const found = await service.getById(records[0].id);
        expect(found).toBeDefined();
        expect(found.student.name).toBe("Ahmad");
        expect(found.subjectScores).toBeDefined();
        expect(found.attendance).toBeDefined();
        expect(found.achievements).toBeDefined();
        expect(found.healthRecord).toBeDefined();
        expect(found.aiSummaries).toBeDefined();
        expect(found.creator.name).toBe("Guru");
      }
    });

    it("throws NotFoundError for non-existent id", async () => {
      expect(service.getById("nonexistent")).rejects.toThrow();
    });
  });

  describe("deleteRecord", () => {
    it("deletes semester record and cascades", async () => {
      const year = await prisma.academicYear.create({ data: { year: "2029/2030" } });
      const cls = await prisma.class.create({ data: { name: "Kelas 6A", academicYearId: year.id } });
      const student = await prisma.student.create({ data: { name: "Del Test", classId: cls.id, nis: "DEL1", nisn: "DEL001", gender: "L" } });
      const rec = await service.create({ studentId: student.id, academicYearId: year.id, semester: 1, createdById: userId });
      const recId = rec.id;

      // Add related data
      await prisma.subjectScore.create({ data: { semesterRecordId: recId, subjectName: "Math", knowledgeScore: 80, skillsScore: 75 } });
      await prisma.attendance.create({ data: { semesterRecordId: recId, sick: 1, permission: 0, absent: 0 } });
      await prisma.achievement.create({ data: { semesterRecordId: recId, title: "A", type: "Akademik" } });

      await service.deleteRecord(recId);
      const found = await prisma.semesterRecord.findUnique({ where: { id: recId } });
      expect(found).toBeNull();

      // Verify cascade
      const scores = await prisma.subjectScore.findMany({ where: { semesterRecordId: recId } });
      expect(scores.length).toBe(0);
      const attendance = await prisma.attendance.findMany({ where: { semesterRecordId: recId } });
      expect(attendance.length).toBe(0);
    });

    it("throws NotFoundError for non-existent record", async () => {
      expect(service.deleteRecord("nonexistent")).rejects.toThrow();
    });
  });
});
