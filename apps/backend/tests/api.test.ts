import { describe, expect, it } from "bun:test";
import { cleanDb, prisma } from "./setup";

// Each test manages its own data independently
describe("API Integration Flows", () => {
  describe("Complete student academic flow", () => {
    it("full lifecycle: year → class → student → semester → scores → preview", async () => {
      await cleanDb();
      const year = await prisma.academicYear.create({ data: { year: "API-2025/2026", isActive: true } });
      const cls = await prisma.class.create({ data: { name: "API-5A", academicYearId: year.id } });
      const student = await prisma.student.create({ data: { name: "Ahmad", classId: cls.id, nis: "API-1001", nisn: "API-001001", gender: "L" } });
      const user = await prisma.user.create({ data: { username: "api-guru", password: "x", name: "Guru", role: "GURU" } });

      const { create: createRecord } = await import("../src/modules/semester-records/semester-record.service");
      const rec = await createRecord({ studentId: student.id, academicYearId: year.id, semester: 1, createdById: user.id });
      const { upsert } = await import("../src/modules/subject-scores/subject-score.service");
      await upsert(rec.id, { subjectName: "Matematika", knowledgeScore: 85, skillsScore: 80 });
      await upsert(rec.id, { subjectName: "IPA", knowledgeScore: 90, skillsScore: 88 });
      const { upsert: upsertAtt } = await import("../src/modules/attendance/attendance.service");
      await upsertAtt(rec.id, { sick: 2, permission: 1, absent: 0 });
      const { create: createAch } = await import("../src/modules/achievements/achievement.service");
      await createAch({ semesterRecordId: rec.id, title: "Juara Kelas", type: "Akademik" });
      const { upsert: upsertHealth } = await import("../src/modules/health-records/health-record.service");
      await upsertHealth(rec.id, { height: 145, weight: 38, hearingCondition: "Normal", visionCondition: "Normal" });

      const { getStudentProfile } = await import("../src/modules/profile/profile.service");
      const profile = await getStudentProfile(student.id);
      expect(profile.student.name).toBe("Ahmad");
      expect(profile.semesterRecords[0].subjectScores.length).toBe(2);

      const { getValidationStatus } = await import("../src/modules/buku-induk/buku-induk.service");
      expect((await getValidationStatus(student.id))[0].status.subjectScores).toBe("complete");

      const { getWorkspace } = await import("../src/modules/buku-induk/buku-induk.service");
      expect((await getWorkspace(student.id)).generatedAt).toBeDefined();
    });
  });

  describe("Incomplete data flow", () => {
    it("marks records as incomplete when data is missing", async () => {
      await cleanDb();
      const year = await prisma.academicYear.create({ data: { year: "API-INC-2026/2027", isActive: true } });
      const cls = await prisma.class.create({ data: { name: "API-INC-6A", academicYearId: year.id } });
      const student = await prisma.student.create({ data: { name: "Budi", classId: cls.id, nis: "API-2001", nisn: "API-002001", gender: "L" } });
      const user = await prisma.user.create({ data: { username: "api-guru2", password: "x", name: "Guru 2", role: "GURU" } });
      const { create: createRecord } = await import("../src/modules/semester-records/semester-record.service");
      const rec = await createRecord({ studentId: student.id, academicYearId: year.id, semester: 1, createdById: user.id });
      const { upsert: upsertAtt } = await import("../src/modules/attendance/attendance.service");
      await upsertAtt(rec.id, { sick: 0, permission: 0, absent: 0 });

      const { getValidationStatus } = await import("../src/modules/buku-induk/buku-induk.service");
      const validation = await getValidationStatus(student.id);
      expect(validation[0].status.subjectScores).toBe("incomplete");
      expect(validation[0].status.attendance).toBe("complete");
      expect(validation[0].status.healthRecord).toBe("incomplete");
    });
  });

  describe("Cross-year student journey", () => {
    it("tracks student across multiple academic years", async () => {
      await cleanDb();
      const year1 = await prisma.academicYear.create({ data: { year: "API-MY-2024/2025" } });
      const year2 = await prisma.academicYear.create({ data: { year: "API-MY-2025/2026" } });
      const teacher = await prisma.user.create({ data: { username: "api-multi", password: "x", name: "Guru Multi", role: "GURU" } });
      const cls1 = await prisma.class.create({ data: { name: "API-MY-5A", academicYearId: year1.id } });
      const cls2 = await prisma.class.create({ data: { name: "API-MY-6A", academicYearId: year2.id } });
      const student = await prisma.student.create({ data: { name: "Multi Year", classId: cls1.id, nis: "API-3001", nisn: "API-003001", gender: "L" } });
      const { create: createRecord } = await import("../src/modules/semester-records/semester-record.service");
      const { upsert } = await import("../src/modules/subject-scores/subject-score.service");
      const r1 = await createRecord({ studentId: student.id, academicYearId: year1.id, semester: 1, createdById: teacher.id });
      await upsert(r1.id, { subjectName: "M", knowledgeScore: 75, skillsScore: 70 });
      const r2 = await createRecord({ studentId: student.id, academicYearId: year1.id, semester: 2, createdById: teacher.id });
      await upsert(r2.id, { subjectName: "M", knowledgeScore: 80, skillsScore: 75 });
      const r3 = await createRecord({ studentId: student.id, academicYearId: year2.id, semester: 1, createdById: teacher.id });
      await upsert(r3.id, { subjectName: "M", knowledgeScore: 85, skillsScore: 80 });
      await prisma.student.update({ where: { id: student.id }, data: { classId: cls2.id } });
      const { getTimeline } = await import("../src/modules/profile/profile.service");
      expect((await getTimeline(student.id)).length).toBe(3);
      const { computeFeatures } = await import("../src/modules/ml/features");
      const features = await computeFeatures(student.id);
      expect(features.scoreDelta).toBeGreaterThan(0);
      expect(features.semesterCount).toBe(3);
    });
  });

  describe("Dashboard integration", () => {
    it("returns correct summary counts after creating data", async () => {
      await cleanDb();
      const { getSummary } = await import("../src/modules/dashboard/dashboard.service");
      const year = await prisma.academicYear.create({ data: { year: "API-DI-2027/2028", isActive: true } });
      const cls = await prisma.class.create({ data: { name: "API-DI-1A", academicYearId: year.id } });
      await prisma.student.create({ data: { name: "D1", classId: cls.id, nis: "API-D1", nisn: "API-D001", gender: "L" } });
      await prisma.student.create({ data: { name: "D2", classId: cls.id, nis: "API-D2", nisn: "API-D002", gender: "P" } });
      const summary = await getSummary("admin-id", "ADMINISTRATOR");
      expect(summary.totalStudents).toBe(2);
      expect(summary.totalClasses).toBe(1);
    });
  });
});
