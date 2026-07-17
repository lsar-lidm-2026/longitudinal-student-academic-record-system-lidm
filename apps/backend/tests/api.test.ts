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
      const rec = await prisma.semesterRecord.create({ data: { studentId: student.id, academicYearId: year.id, semester: 1, createdById: user.id } });

      // 3. Add scores
      const { upsert } = await import("../src/modules/subject-scores/subject-score.service");
      await upsert(rec.id, { subjectName: "Matematika", knowledgeScore: 85, skillsScore: 80 });
      await upsert(rec.id, { subjectName: "IPA", knowledgeScore: 90, skillsScore: 88 });

      // 4. Add attendance
      const { upsert: upsertAtt } = await import("../src/modules/attendance/attendance.service");
      await upsertAtt(rec.id, { sick: 2, permission: 1, absent: 0 });

      // 5. Add achievement
      const { create: createAch } = await import("../src/modules/achievements/achievement.service");
      await createAch({ semesterRecordId: rec.id, title: "Juara Kelas", type: "Akademik" });

      // 6. Verify profile
      const { getStudentProfile } = await import("../src/modules/profile/profile.service");
      const profile = await getStudentProfile(student.id);
      expect(profile.student.name).toBe("Ahmad");
      expect(profile.semesterRecords.length).toBe(1);
      expect(profile.semesterRecords[0].subjectScores.length).toBe(2);

      // 7. Verify validation status
      const { getValidationStatus } = await import("../src/modules/buku-induk/buku-induk.service");
      const validation = await getValidationStatus(student.id);
      expect(validation[0].status.subjectScores).toBe("complete");
      expect(validation[0].status.attendance).toBe("complete");

      // 8. Verify buku induk preview
      const { getPreview } = await import("../src/modules/buku-induk/buku-induk.service");
      const preview = await getPreview(student.id);
      expect(preview.biodata.name).toBe("Ahmad");
      expect(preview.semesterRecords[0].subjectScores.length).toBe(2);
    });
  });
});
