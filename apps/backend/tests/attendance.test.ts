import { describe, expect, it, beforeAll } from "bun:test";
import { cleanDb, prisma } from "./setup";
import * as service from "../src/modules/attendance/attendance.service";

describe("Attendance Upsert", () => {
  let recordId: string;

  beforeAll(async () => {
    await cleanDb();
    const year = await prisma.academicYear.create({ data: { year: "2025/2026" } });
    const cls = await prisma.class.create({ data: { name: "Kelas 5A", academicYearId: year.id } });
    const student = await prisma.student.create({ data: { name: "A", classId: cls.id, nis: "1", nisn: "1", gender: "L" } });
    const user = await prisma.user.create({ data: { username: "g", password: "x", name: "G", role: "GURU" } });
    const rec = await prisma.semesterRecord.create({ data: { studentId: student.id, academicYearId: year.id, semester: 1, createdById: user.id } });
    recordId = rec.id;
  });

  it("creates attendance (upsert)", async () => {
    const a = await service.upsert(recordId, { sick: 2, permission: 1, absent: 0 });
    expect(a.sick).toBe(2);
    expect(a.permission).toBe(1);
    expect(a.absent).toBe(0);
  });

  it("updates existing attendance (upsert)", async () => {
    const a = await service.upsert(recordId, { sick: 3, permission: 2, absent: 1 });
    expect(a.sick).toBe(3);
    expect(a.permission).toBe(2);
    expect(a.absent).toBe(1);
  });

  it("maintains single record (1:1)", async () => {
    const all = await prisma.attendance.findMany({ where: { semesterRecordId: recordId } });
    expect(all.length).toBe(1);
  });

  it("handles zero values", async () => {
    const a = await service.upsert(recordId, { sick: 0, permission: 0, absent: 0 });
    expect(a.sick).toBe(0);
    expect(a.permission).toBe(0);
    expect(a.absent).toBe(0);
  });

  it("handles large absence values", async () => {
    const a = await service.upsert(recordId, { sick: 10, permission: 5, absent: 7 });
    expect(a.sick).toBe(10);
    expect(a.permission).toBe(5);
    expect(a.absent).toBe(7);
  });

  it("throws NotFoundError for non-existent semester record", async () => {
    expect(service.upsert("nonexistent", { sick: 0, permission: 0, absent: 0 })).rejects.toThrow();
  });
});
