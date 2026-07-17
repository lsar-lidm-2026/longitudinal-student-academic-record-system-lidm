import { describe, expect, it } from "bun:test";
import "./setup";
import { db, nextId } from "./setup";
import * as service from "../src/modules/buku-induk/buku-induk.service";

describe("Buku Induk Service", () => {
  function seedFullStudent() {
    const studentId = nextId();
    db.student.set(studentId, { id: studentId, nis: "1001", nisn: "001001", name: "Ahmad", gender: "L", classId: nextId(), createdAt: new Date(), updatedAt: new Date() });
    return studentId;
  }

  describe("getPreview", () => {
    it("returns biodata and semester records", async () => {
      const studentId = seedFullStudent();
      const preview = await service.getPreview(studentId);
      expect(preview.biodata.name).toBe("Ahmad");
      expect(preview.biodata.nis).toBe("1001");
      expect(preview.semesterRecords).toEqual([]);
    });

    it("includes semester data when available", async () => {
      const studentId = seedFullStudent();
      const recordId = nextId();
      db.semesterRecord.set(recordId, { id: recordId, studentId, academicYearId: nextId(), semester: 1, createdById: nextId(), createdAt: new Date(), updatedAt: new Date() });
      const preview = await service.getPreview(studentId);
      expect(preview.semesterRecords.length).toBe(1);
    });
  });

  describe("getValidationStatus", () => {
    it("shows incomplete when no data", async () => {
      const studentId = seedFullStudent();
      const status = await service.getValidationStatus(studentId);
      expect(status).toEqual([]);
    });

    it("shows completion status per semester", async () => {
      const studentId = seedFullStudent();
      const recordId = nextId();
      db.semesterRecord.set(recordId, { id: recordId, studentId, academicYearId: nextId(), semester: 1, createdById: nextId(), createdAt: new Date(), updatedAt: new Date() });
      // Add scores
      db.subjectScore.set(nextId(), { id: nextId(), semesterRecordId: recordId, subjectName: "Matematika", knowledgeScore: 80, skillsScore: 75, notes: null, createdAt: new Date(), updatedAt: new Date() });
      const status = await service.getValidationStatus(studentId);
      expect(status.length).toBe(1);
      expect(status[0].status.subjectScores).toBe("complete");
      expect(status[0].status.attendance).toBe("incomplete");
    });
  });

  describe("getWorkspace", () => {
    it("combines preview and validation", async () => {
      const studentId = seedFullStudent();
      const ws = await service.getWorkspace(studentId);
      expect(ws.preview).toBeDefined();
      expect(ws.validation).toBeDefined();
      expect(ws.generatedAt).toBeDefined();
    });
  });
});
