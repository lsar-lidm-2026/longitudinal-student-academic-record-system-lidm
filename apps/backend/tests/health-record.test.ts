import { describe, expect, it, beforeAll } from "bun:test";
import { cleanDb, prisma } from "./setup";
import * as service from "../src/modules/health-records/health-record.service";

describe("HealthRecord Upsert", () => {
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

  it("creates health record", async () => {
    const h = await service.upsert(recordId, { height: 150, weight: 40 });
    expect(h.height).toBe(150);
  });

  it("updates existing record (upsert)", async () => {
    const h = await service.upsert(recordId, { height: 152, weight: 42 });
    expect(h.height).toBe(152);
  });

  it("maintains single record (1:1)", async () => {
    const all = await prisma.healthRecord.findMany({ where: { semesterRecordId: recordId } });
    expect(all.length).toBe(1);
  });

  it("stores optional fields", async () => {
    const h = await service.upsert(recordId, { height: 150, weight: 40, hearingCondition: "Normal", visionCondition: "Normal" });
    expect(h.hearingCondition).toBe("Normal");
    expect(h.visionCondition).toBe("Normal");
  });
});
