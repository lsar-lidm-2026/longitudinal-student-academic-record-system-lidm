import { describe, expect, it } from "bun:test";
import { cleanDb, prisma } from "./setup";
import * as service from "../src/modules/dashboard/dashboard.service";

// Each test manages its own data by calling cleanDb() independently
// Bun runs beforeAll across sibling describe blocks first,
// then tests, so we can't rely on beforeAll for data isolation.

describe("ADMINISTRATOR summary", () => {
  it("returns counts of students and classes when data exists", async () => {
    await cleanDb();
    const year = await prisma.academicYear.create({ data: { year: "D-ADM-2025/2026", isActive: true } });
    const c1 = await prisma.class.create({ data: { name: "Kelas 5A", academicYearId: year.id } });
    const c2 = await prisma.class.create({ data: { name: "Kelas 5B", academicYearId: year.id } });
    await prisma.student.create({ data: { name: "S1", classId: c1.id, nis: "D1", nisn: "D1", gender: "L" } });
    await prisma.student.create({ data: { name: "S2", classId: c2.id, nis: "D2", nisn: "D2", gender: "P" } });

    const summary = await service.getSummary("admin-id", "ADMINISTRATOR");
    expect(summary.totalStudents).toBe(2);
    expect(summary.totalClasses).toBe(2);
    expect(summary.activeYear).toBe("D-ADM-2025/2026");
  });

  it("returns zero counts when no data", async () => {
    await cleanDb();
    const summary = await service.getSummary("admin-id", "ADMINISTRATOR");
    expect(summary.totalStudents).toBe(0);
    expect(summary.totalClasses).toBe(0);
    expect(summary.activeYear).toBeNull();
  });

  it("includes pendingAiDrafts count", async () => {
    await cleanDb();
    const year = await prisma.academicYear.create({ data: { year: "D-ADM2-2026/2027", isActive: true } });
    const cls = await prisma.class.create({ data: { name: "Kelas 5A", academicYearId: year.id } });
    const user = await prisma.user.create({ data: { username: "g-sum", password: "x", name: "G", role: "GURU" } });
    const student = await prisma.student.create({ data: { name: "S1", classId: cls.id, nis: "SUM1", nisn: "SUM001", gender: "L" } });
    const rec = await prisma.semesterRecord.create({ data: { studentId: student.id, academicYearId: year.id, semester: 1, createdById: user.id } });
    await prisma.aiSummary.create({ data: { semesterRecordId: rec.id, summaryType: "STUDENT_SUMMARY", content: "test", isFinal: false, version: 1 } });
    await prisma.aiSummary.create({ data: { semesterRecordId: rec.id, summaryType: "DRAFT_DESCRIPTION", content: "test2", isFinal: true, version: 1 } });

    const summary = await service.getSummary("admin-id", "ADMINISTRATOR");
    expect(summary.pendingAiDrafts).toBe(1);
  });
});

describe("KEPALA_SEKOLAH summary", () => {
  it("returns same comprehensive stats as ADMINISTRATOR", async () => {
    await cleanDb();
    const year = await prisma.academicYear.create({ data: { year: "D-KS-2025/2026", isActive: true } });
    const cls = await prisma.class.create({ data: { name: "Kelas 5A", academicYearId: year.id } });
    await prisma.student.create({ data: { name: "S1", classId: cls.id, nis: "KEP1", nisn: "KEP001", gender: "L" } });
    const summary = await service.getSummary("kepsek-id", "KEPALA_SEKOLAH");
    expect(summary.totalStudents).toBe(1);
    expect(summary.totalClasses).toBe(1);
    expect(summary.activeYear).toBeDefined();
  });
});

describe("GURU summary", () => {
  it("returns managed classes", async () => {
    await cleanDb();
    const teacherId = "teacher-uuid";
    await prisma.user.create({ data: { id: teacherId, username: "guru-sum", password: "x", name: "Guru", role: "GURU" } });
    const year = await prisma.academicYear.create({ data: { year: "D-G-2025/2026" } });
    const cls = await prisma.class.create({ data: { name: "Kelas 5A", academicYearId: year.id, homeroomTeacherId: teacherId } });
    const summary = await service.getSummary(teacherId, "GURU");
    expect(summary.managedClasses.length).toBe(1);
    expect(summary.managedClasses[0].name).toBe("Kelas 5A");
  });

  it("returns empty managed classes when teacher has no class", async () => {
    await cleanDb();
    const teacherId = "teacher-noclass";
    await prisma.user.create({ data: { id: teacherId, username: "guru-nc", password: "x", name: "Guru NC", role: "GURU" } });
    const year = await prisma.academicYear.create({ data: { year: "D-G2-2025/2026" } });
    const summary = await service.getSummary(teacherId, "GURU");
    expect(summary.managedClasses).toEqual([]);
    expect(summary.totalStudents).toBe(0);
  });

  it("returns totalStudents only from managed classes", async () => {
    await cleanDb();
    const teacherId = "teacher-mg";
    await prisma.user.create({ data: { id: teacherId, username: "guru-mg", password: "x", name: "Guru MG", role: "GURU" } });
    const year = await prisma.academicYear.create({ data: { year: "D-G3-2025/2026" } });
    const cls1 = await prisma.class.create({ data: { name: "Kelas 5A", academicYearId: year.id, homeroomTeacherId: teacherId } });
    const cls2 = await prisma.class.create({ data: { name: "Kelas 5B", academicYearId: year.id } });
    await prisma.student.create({ data: { name: "My Student", classId: cls1.id, nis: "MG1", nisn: "MG001", gender: "L" } });
    await prisma.student.create({ data: { name: "Other Student", classId: cls2.id, nis: "MG2", nisn: "MG002", gender: "P" } });
    const summary = await service.getSummary(teacherId, "GURU");
    expect(summary.totalStudents).toBe(1);
  });
});

describe("OPERATOR summary", () => {
  it("returns basic counts without pendingAiDrafts", async () => {
    await cleanDb();
    const year = await prisma.academicYear.create({ data: { year: "D-OP-2025/2026", isActive: true } });
    const cls = await prisma.class.create({ data: { name: "Kelas 5A", academicYearId: year.id } });
    await prisma.student.create({ data: { name: "S1", classId: cls.id, nis: "OP1", nisn: "OP001", gender: "L" } });
    const summary = await service.getSummary("op-id", "OPERATOR_SEKOLAH");
    expect(summary.totalStudents).toBe(1);
    expect(summary.totalClasses).toBe(1);
    expect((summary as any).pendingAiDrafts).toBeUndefined();
  });
});
