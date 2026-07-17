import { describe, expect, it, beforeAll } from "bun:test";
import { cleanDb, prisma } from "./setup";
import * as service from "../src/modules/achievements/achievement.service";

describe("Achievement Service", () => {
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

  it("creates achievement", async () => {
    const a = await service.create({ semesterRecordId: recordId, title: "Juara 1", type: "Akademik" });
    expect(a.title).toBe("Juara 1");
  });

  it("stores multiple achievements", async () => {
    await service.create({ semesterRecordId: recordId, title: "A1", type: "Akademik" });
    await service.create({ semesterRecordId: recordId, title: "A2", type: "Non-Akademik" });
    const all = await prisma.achievement.findMany({ where: { semesterRecordId: recordId } });
    expect(all.length).toBe(3); // 1 from previous test + 2 from this one
  });
});
