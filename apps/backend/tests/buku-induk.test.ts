import { describe, expect, it } from "bun:test";
import { cleanDb, prisma } from "./setup";
import * as service from "../src/modules/buku-induk/buku-induk.service";

// Each test cleans and creates its own data
describe("Buku Induk Service", () => {
  describe("getPreview", () => {
    it("returns biodata and empty semester records", async () => {
      await cleanDb();
      const year = await prisma.academicYear.create({ data: { year: "BI-P-2025/2026" } });
      const cls = await prisma.class.create({ data: { name: "Kelas 5A", academicYearId: year.id } });
      const student = await prisma.student.create({ data: { name: "Ahmad", classId: cls.id, nis: "BI-1001", nisn: "BI-001001", gender: "L" } });
      const preview = await service.getPreview(student.id);
      expect(preview.biodata.name).toBe("Ahmad");
      expect(preview.semesterRecords).toEqual([]);
    });

    it("includes semester data when available", async () => {
      await cleanDb();
      const year = await prisma.academicYear.create({ data: { year: "BI-P2-2025/2026" } });
      const cls = await prisma.class.create({ data: { name: "Kelas 5A", academicYearId: year.id } });
      const user = await prisma.user.create({ data: { username: "bi-p-u", password: "x", name: "BI-U", role: "GURU" } });
      const student = await prisma.student.create({ data: { name: "Budi", classId: cls.id, nis: "BI-2001", nisn: "BI-002001", gender: "L" } });
      await prisma.semesterRecord.create({ data: { studentId: student.id, academicYearId: year.id, semester: 1, createdById: user.id } });
      expect((await service.getPreview(student.id)).semesterRecords.length).toBe(1);
    });

    it("throws NotFoundError for non-existent student", async () => {
      expect(service.getPreview("nonexistent")).rejects.toThrow();
    });
  });

  describe("getValidationStatus", () => {
    it("shows empty when no semester records", async () => {
      await cleanDb();
      const year = await prisma.academicYear.create({ data: { year: "BI-V-2025/2026" } });
      const cls = await prisma.class.create({ data: { name: "Kelas 5A", academicYearId: year.id } });
      const student = await prisma.student.create({ data: { name: "Val T", classId: cls.id, nis: "BI-3001", nisn: "BI-003001", gender: "L" } });
      expect(await service.getValidationStatus(student.id)).toEqual([]);
    });

    it("marks attendance and health as incomplete when data missing", async () => {
      await cleanDb();
      const year = await prisma.academicYear.create({ data: { year: "BI-V2-2025/2026" } });
      const cls = await prisma.class.create({ data: { name: "Kelas 5A", academicYearId: year.id } });
      const user = await prisma.user.create({ data: { username: "bi-v2-u", password: "x", name: "BI-V2", role: "GURU" } });
      const student = await prisma.student.create({ data: { name: "Val S", classId: cls.id, nis: "BI-4001", nisn: "BI-004001", gender: "L" } });
      const rec = await prisma.semesterRecord.create({ data: { studentId: student.id, academicYearId: year.id, semester: 1, createdById: user.id } });
      await prisma.subjectScore.create({ data: { semesterRecordId: rec.id, subjectName: "M", knowledgeScore: 80, skillsScore: 75 } });
      const status = await service.getValidationStatus(student.id);
      expect(status[0].status.subjectScores).toBe("complete");
      expect(status[0].status.attendance).toBe("incomplete");
      expect(status[0].status.healthRecord).toBe("incomplete");
    });

    it("marks all complete when all data present", async () => {
      await cleanDb();
      const year = await prisma.academicYear.create({ data: { year: "BI-V3-2025/2026" } });
      const cls = await prisma.class.create({ data: { name: "Kelas 5A", academicYearId: year.id } });
      const user = await prisma.user.create({ data: { username: "bi-v3-u", password: "x", name: "BI-V3", role: "GURU" } });
      const student = await prisma.student.create({ data: { name: "Complete S", classId: cls.id, nis: "BI-5001", nisn: "BI-005001", gender: "L" } });
      const rec = await prisma.semesterRecord.create({ data: { studentId: student.id, academicYearId: year.id, semester: 1, createdById: user.id } });
      await prisma.subjectScore.create({ data: { semesterRecordId: rec.id, subjectName: "M", knowledgeScore: 80, skillsScore: 75 } });
      await prisma.attendance.create({ data: { semesterRecordId: rec.id, sick: 1, permission: 0, absent: 0 } });
      await prisma.healthRecord.create({ data: { semesterRecordId: rec.id, height: 150, weight: 40 } });
      const status = await service.getValidationStatus(student.id);
      expect(status[0].status.subjectScores).toBe("complete");
      expect(status[0].status.attendance).toBe("complete");
      expect(status[0].status.healthRecord).toBe("complete");
    });
  });

  describe("getWorkspace", () => {
    it("combines preview and validation", async () => {
      await cleanDb();
      const year = await prisma.academicYear.create({ data: { year: "BI-W-2025/2026" } });
      const cls = await prisma.class.create({ data: { name: "Kelas 5A", academicYearId: year.id } });
      const student = await prisma.student.create({ data: { name: "WS", classId: cls.id, nis: "BI-6001", nisn: "BI-006001", gender: "L" } });
      const ws = await service.getWorkspace(student.id);
      expect(ws.preview).toBeDefined();
      expect(ws.validation).toBeDefined();
      expect(ws.generatedAt).toBeDefined();
    });
  });
});
