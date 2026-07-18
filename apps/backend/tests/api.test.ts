import { describe, expect, it, beforeAll } from "bun:test";
import { cleanDb, prisma } from "./setup";

describe("API Integration Flows", () => {
  beforeAll(async () => { await cleanDb(); });

  describe("Complete student academic flow", () => {
    it("full lifecycle: year → class → student → semester → scores → preview", async () => {
      // 1. Create year + class + student
      const year = await prisma.academicYear.create({ data: { year: "2025/2026", isActive: true } });
      const cls = await prisma.class.create({ data: { name: "Kelas 5A", academicYearId: year.id } });
      const student = await prisma.student.create({ data: { name: "Ahmad", classId: cls.id, nis: "1001", nisn: "001001", gender: "L" } });
      const user = await prisma.user.create({ data: { username: "guru", password: "x", name: "Guru", role: "GURU" } });

      // 2. Create semester record
      const { create: createRecord } = await import("../src/modules/semester-records/semester-record.service");
      const rec = await createRecord({ studentId: student.id, academicYearId: year.id, semester: 1, createdById: user.id });

      // 3. Add scores
      const { upsert } = await import("../src/modules/subject-scores/subject-score.service");
      await upsert(rec.id, { subjectName: "Matematika", knowledgeScore: 85, skillsScore: 80 });
      await upsert(rec.id, { subjectName: "IPA", knowledgeScore: 90, skillsScore: 88 });
      await upsert(rec.id, { subjectName: "Bahasa Indonesia", knowledgeScore: 78, skillsScore: 75 });

      // 4. Add attendance
      const { upsert: upsertAtt } = await import("../src/modules/attendance/attendance.service");
      await upsertAtt(rec.id, { sick: 2, permission: 1, absent: 0 });

      // 5. Add achievement
      const { create: createAch } = await import("../src/modules/achievements/achievement.service");
      await createAch({ semesterRecordId: rec.id, title: "Juara Kelas", type: "Akademik" });

      // 6. Add health record
      const { upsert: upsertHealth } = await import("../src/modules/health-records/health-record.service");
      await upsertHealth(rec.id, { height: 145, weight: 38, hearingCondition: "Normal", visionCondition: "Normal" });

      // 7. Verify profile
      const { getStudentProfile } = await import("../src/modules/profile/profile.service");
      const profile = await getStudentProfile(student.id);
      expect(profile.student.name).toBe("Ahmad");
      expect(profile.semesterRecords.length).toBe(1);
      expect(profile.semesterRecords[0].subjectScores.length).toBe(3);
      expect(profile.semesterRecords[0].attendance).toBeDefined();
      expect(profile.semesterRecords[0].achievements.length).toBe(1);
      expect(profile.semesterRecords[0].healthRecord).toBeDefined();

      // 8. Verify validation status (all complete)
      const { getValidationStatus } = await import("../src/modules/buku-induk/buku-induk.service");
      const validation = await getValidationStatus(student.id);
      expect(validation.length).toBe(1);
      expect(validation[0].status.subjectScores).toBe("complete");
      expect(validation[0].status.attendance).toBe("complete");
      expect(validation[0].status.healthRecord).toBe("complete");

      // 9. Verify buku induk preview
      const { getPreview } = await import("../src/modules/buku-induk/buku-induk.service");
      const preview = await getPreview(student.id);
      expect(preview.biodata.name).toBe("Ahmad");
      expect(preview.semesterRecords.length).toBe(1);
      expect(preview.semesterRecords[0].subjectScores.length).toBe(3);
      expect(preview.semesterRecords[0].attendance).toBeDefined();
      expect(preview.semesterRecords[0].achievements.length).toBe(1);
      expect(preview.semesterRecords[0].healthRecord).toBeDefined();

      // 10. Verify workspace combines preview + validation
      const { getWorkspace } = await import("../src/modules/buku-induk/buku-induk.service");
      const ws = await getWorkspace(student.id);
      expect(ws.preview.biodata.name).toBe("Ahmad");
      expect(ws.validation.length).toBe(1);
      expect(ws.generatedAt).toBeDefined();
    });
  });

  describe("Incomplete data flow", () => {
    it("marks records as incomplete when data is missing", async () => {
      const year = await prisma.academicYear.create({ data: { year: "2026/2027", isActive: true } });
      const cls = await prisma.class.create({ data: { name: "Kelas 6A", academicYearId: year.id } });
      const student = await prisma.student.create({ data: { name: "Budi", classId: cls.id, nis: "2001", nisn: "002001", gender: "L" } });
      const user = await prisma.user.create({ data: { username: "guru2", password: "x", name: "Guru 2", role: "GURU" } });

      // Create record without scores (only attendance)
      const { create: createRecord } = await import("../src/modules/semester-records/semester-record.service");
      const rec = await createRecord({ studentId: student.id, academicYearId: year.id, semester: 1, createdById: user.id });

      // Only add attendance, skip scores, achievements, health
      const { upsert: upsertAtt } = await import("../src/modules/attendance/attendance.service");
      await upsertAtt(rec.id, { sick: 0, permission: 0, absent: 0 });

      // Verify validation — only attendance complete
      const { getValidationStatus } = await import("../src/modules/buku-induk/buku-induk.service");
      const validation = await getValidationStatus(student.id);
      expect(validation.length).toBe(1);
      expect(validation[0].status.subjectScores).toBe("incomplete");
      expect(validation[0].status.attendance).toBe("complete");
      expect(validation[0].status.healthRecord).toBe("incomplete");
    });
  });

  describe("Cross-year student journey", () => {
    it("tracks student across multiple academic years", async () => {
      const year1 = await prisma.academicYear.create({ data: { year: "2024/2025" } });
      const year2 = await prisma.academicYear.create({ data: { year: "2025/2026" } });

      const teacher = await prisma.user.create({ data: { username: "guru-multi", password: "x", name: "Guru Multi", role: "GURU" } });

      const cls1 = await prisma.class.create({ data: { name: "Kelas 5A", academicYearId: year1.id } });
      const cls2 = await prisma.class.create({ data: { name: "Kelas 6A", academicYearId: year2.id } });

      const student = await prisma.student.create({ data: { name: "Multi Year", classId: cls1.id, nis: "3001", nisn: "003001", gender: "L" } });

      // Year 1, Semester 1
      const { create: createRecord } = await import("../src/modules/semester-records/semester-record.service");
      const rec1 = await createRecord({ studentId: student.id, academicYearId: year1.id, semester: 1, createdById: teacher.id });
      const { upsert } = await import("../src/modules/subject-scores/subject-score.service");
      await upsert(rec1.id, { subjectName: "Matematika", knowledgeScore: 75, skillsScore: 70 });

      // Year 1, Semester 2
      const rec2 = await createRecord({ studentId: student.id, academicYearId: year1.id, semester: 2, createdById: teacher.id });
      await upsert(rec2.id, { subjectName: "Matematika", knowledgeScore: 80, skillsScore: 75 });

      // Year 2, Semester 1
      const rec3 = await createRecord({ studentId: student.id, academicYearId: year2.id, semester: 1, createdById: teacher.id });
      await upsert(rec3.id, { subjectName: "Matematika", knowledgeScore: 85, skillsScore: 80 });

      // Move to new class
      await prisma.student.update({ where: { id: student.id }, data: { classId: cls2.id } });

      // Verify timeline
      const { getTimeline } = await import("../src/modules/profile/profile.service");
      const timeline = await getTimeline(student.id);
      expect(timeline.length).toBe(3);
      expect(timeline[0].year).toBe("2024/2025");
      expect(timeline[0].semester).toBe(1);
      expect(timeline[2].year).toBe("2025/2026");
      expect(timeline[2].semester).toBe(1);

      // Verify ML features capture the improvement
      const { computeFeatures } = await import("../src/modules/ml/features");
      const features = await computeFeatures(student.id);
      expect(features.scoreDelta).toBeGreaterThan(0); // improved
      expect(features.semesterCount).toBe(3);
    });
  });

  describe("Dashboard integration with seeded data", () => {
    it("returns correct summary counts after creating data", async () => {
      const { getSummary } = await import("../src/modules/dashboard/dashboard.service");
      const year = await prisma.academicYear.create({ data: { year: "2027/2028", isActive: true } });
      const cls = await prisma.class.create({ data: { name: "Kelas 1A", academicYearId: year.id } });
      await prisma.student.create({ data: { name: "D1", classId: cls.id, nis: "D1", nisn: "D001", gender: "L" } });
      await prisma.student.create({ data: { name: "D2", classId: cls.id, nis: "D2", nisn: "D002", gender: "P" } });

      const summary = await getSummary("admin-id", "ADMINISTRATOR");
      expect(summary.totalStudents).toBe(2);
      expect(summary.totalClasses).toBe(1);
    });
  });
});
