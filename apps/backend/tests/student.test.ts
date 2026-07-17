import { describe, expect, it, beforeAll } from "bun:test";
import { cleanDb, prisma } from "./setup";
import * as service from "../src/modules/students/student.service";

describe("Student Service", () => {
  let yearId: string, classId: string;

  beforeAll(async () => {
    await cleanDb();
    const year = await prisma.academicYear.create({ data: { year: "2025/2026" } });
    yearId = year.id;
    const cls = await prisma.class.create({ data: { name: "Kelas 5A", academicYearId: year.id } });
    classId = cls.id;
  });

  describe("create", () => {
    it("creates student with unique NIS/NISN", async () => {
      const s = await service.create({ nis: "1001", nisn: "001001", name: "Ahmad", gender: "L", classId });
      expect(s.name).toBe("Ahmad");
    });

    it("rejects duplicate NIS", async () => {
      expect(service.create({ nis: "1001", nisn: "009999", name: "B", gender: "L", classId })).rejects.toThrow();
    });

    it("rejects duplicate NISN", async () => {
      expect(service.create({ nis: "9999", nisn: "001001", name: "C", gender: "L", classId })).rejects.toThrow();
    });
  });

  describe("list", () => {
    it("returns paginated students", async () => {
      for (let i = 0; i < 5; i++) {
        await service.create({ nis: `${2000 + i}`, nisn: `${2000 + i}`, name: `Siswa ${i}`, gender: "L", classId });
      }
      const result = await service.list({ page: "1", limit: "3" });
      expect(result.data.length).toBe(3);
      expect(result.total).toBeGreaterThanOrEqual(5);
    });
  });

  describe("getById", () => {
    it("returns student", async () => {
      const s = await service.create({ nis: "3001", nisn: "003001", name: "Budi", gender: "L", classId });
      const found = await service.getById(s.id);
      expect(found.name).toBe("Budi");
    });
  });

  describe("update", () => {
    it("updates student fields", async () => {
      const s = await service.create({ nis: "4001", nisn: "004001", name: "Budi", gender: "L", classId });
      const updated = await service.update(s.id, { name: "Budi Update" });
      expect(updated.name).toBe("Budi Update");
    });
  });
});
