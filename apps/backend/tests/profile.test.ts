import { describe, expect, it, beforeAll } from "bun:test";
import { cleanDb, prisma } from "./setup";
import * as profileService from "../src/modules/profile/profile.service";

describe("Profile Service", () => {
  let studentId: string, yearId: string, userId: string;

  beforeAll(async () => {
    await cleanDb();
    const year = await prisma.academicYear.create({ data: { year: "2025/2026" } });
    yearId = year.id;
    const cls = await prisma.class.create({ data: { name: "Kelas 5A", academicYearId: year.id } });
    const student = await prisma.student.create({ data: { name: "Ahmad", classId: cls.id, nis: "1001", nisn: "001001", gender: "L" } });
    studentId = student.id;
    const user = await prisma.user.create({ data: { username: "guru-pro", password: "x", name: "Guru Pro", role: "GURU" } });
    userId = user.id;

    // Create a semester record with all related data
    const rec = await prisma.semesterRecord.create({
      data: { studentId, academicYearId: year.id, semester: 1, createdById: userId },
    });

    await prisma.subjectScore.create({
      data: { semesterRecordId: rec.id, subjectName: "Matematika", knowledgeScore: 85, skillsScore: 80 },
    });
    await prisma.attendance.create({
      data: { semesterRecordId: rec.id, sick: 2, permission: 1, absent: 0 },
    });
    await prisma.achievement.create({
      data: { semesterRecordId: rec.id, title: "Juara Kelas", type: "Akademik" },
    });
    await prisma.healthRecord.create({
      data: { semesterRecordId: rec.id, height: 150, weight: 40, hearingCondition: "Normal" },
    });
    await prisma.aiSummary.create({
      data: {
        semesterRecordId: rec.id,
        summaryType: "STUDENT_SUMMARY",
        content: "Ringkasan final",
        isFinal: true,
        version: 1,
      },
    });
    await prisma.aiSummary.create({
      data: {
        semesterRecordId: rec.id,
        summaryType: "DRAFT_DESCRIPTION",
        content: "Draft description",
        isFinal: false,
        version: 1,
      },
    });
  });

  describe("getStudentProfile", () => {
    it("returns student with semester records and all relations", async () => {
      const profile = await profileService.getStudentProfile(studentId);
      expect(profile.student.name).toBe("Ahmad");
      expect(profile.student.class.name).toBe("Kelas 5A");
      expect(profile.semesterRecords.length).toBe(1);
    });

    it("includes subject scores in semester records", async () => {
      const profile = await profileService.getStudentProfile(studentId);
      const record = profile.semesterRecords[0];
      expect(record.subjectScores.length).toBe(1);
      expect(record.subjectScores[0].subjectName).toBe("Matematika");
    });

    it("includes attendance in semester records", async () => {
      const profile = await profileService.getStudentProfile(studentId);
      expect(profile.semesterRecords[0].attendance).toBeDefined();
      expect(profile.semesterRecords[0].attendance!.sick).toBe(2);
    });

    it("includes achievements in semester records", async () => {
      const profile = await profileService.getStudentProfile(studentId);
      expect(profile.semesterRecords[0].achievements.length).toBe(1);
    });

    it("includes health record in semester records", async () => {
      const profile = await profileService.getStudentProfile(studentId);
      expect(profile.semesterRecords[0].healthRecord).toBeDefined();
      expect(profile.semesterRecords[0].healthRecord!.height).toBe(150);
    });

    it("includes only finalized AI summaries in semester records", async () => {
      const profile = await profileService.getStudentProfile(studentId);
      const summaries = profile.semesterRecords[0].aiSummaries;
      expect(summaries.length).toBe(1); // only the isFinal: true one
      expect(summaries[0].summaryType).toBe("STUDENT_SUMMARY");
    });

    it("throws NotFoundError for non-existent student", async () => {
      expect(profileService.getStudentProfile("nonexistent")).rejects.toThrow();
    });

    it("returns empty semester records for student with no data", async () => {
      const cls = await prisma.class.create({ data: { name: "Empty Profile", academicYearId: yearId } });
      const student = await prisma.student.create({ data: { name: "No Data", classId: cls.id, nis: "NODATA", nisn: "NODATAN", gender: "L" } });
      const profile = await profileService.getStudentProfile(student.id);
      expect(profile.student.name).toBe("No Data");
      expect(profile.semesterRecords).toEqual([]);
    });
  });

  describe("getTimeline", () => {
    it("returns timeline entries in chronological order", async () => {
      const timeline = await profileService.getTimeline(studentId);
      expect(timeline.length).toBe(1);
      expect(timeline[0].semester).toBe(1);
      expect(timeline[0].year).toBe("2025/2026");
      expect(timeline[0].label).toBe("Semester Ganjil 2025/2026");
    });

    it("includes multiple semesters in order", async () => {
      const year2 = await prisma.academicYear.create({ data: { year: "2024/2025" } });
      const cls = await prisma.class.create({ data: { name: "Kelas 4A", academicYearId: year2.id } });
      const student = await prisma.student.create({ data: { name: "Timeline Test", classId: cls.id, nis: "TL1", nisn: "TL001", gender: "L" } });
      await prisma.semesterRecord.create({ data: { studentId: student.id, academicYearId: year2.id, semester: 1, createdById: userId } });
      await prisma.semesterRecord.create({ data: { studentId: student.id, academicYearId: year2.id, semester: 2, createdById: userId } });

      const timeline = await profileService.getTimeline(student.id);
      expect(timeline.length).toBe(2);
      expect(timeline[0].semester).toBe(1);
      expect(timeline[1].semester).toBe(2);
      expect(timeline[0].label).toContain("Ganjil");
      expect(timeline[1].label).toContain("Genap");
    });

    it("returns empty array for student with no records", async () => {
      const cls = await prisma.class.create({ data: { name: "Empty Timelines", academicYearId: yearId } });
      const student = await prisma.student.create({ data: { name: "No Timeline", classId: cls.id, nis: "NOTL", nisn: "NOTLN", gender: "L" } });
      const timeline = await profileService.getTimeline(student.id);
      expect(timeline).toEqual([]);
    });
  });
});
