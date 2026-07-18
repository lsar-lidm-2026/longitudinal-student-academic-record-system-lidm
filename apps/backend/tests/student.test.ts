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
      expect(s.nis).toBe("1001");
      expect(s.nisn).toBe("001001");
      expect(s.gender).toBe("L");
    });

    it("rejects duplicate NIS", async () => {
      expect(service.create({ nis: "1001", nisn: "009999", name: "B", gender: "L", classId })).rejects.toThrow();
    });

    it("rejects duplicate NISN", async () => {
      expect(service.create({ nis: "9999", nisn: "001001", name: "C", gender: "L", classId })).rejects.toThrow();
    });

    it("accepts both genders", async () => {
      const l = await service.create({ nis: "2001", nisn: "002001", name: "Laki", gender: "L", classId });
      const p = await service.create({ nis: "2002", nisn: "002002", name: "Perempuan", gender: "P", classId });
      expect(l.gender).toBe("L");
      expect(p.gender).toBe("P");
    });

    it("throws when class does not exist", async () => {
      expect(service.create({ nis: "3001", nisn: "003001", name: "NoClass", gender: "L", classId: "nonexistent" })).rejects.toThrow();
    });
  });

  describe("list", () => {
    beforeAll(async () => {
      // Ensure clean data for pagination tests
      const existingIds = (await prisma.student.findMany({ select: { id: true } })).map(s => s.id);
      // Already have some from create tests
    });

    it("returns paginated students", async () => {
      // Add 5 more students
      for (let i = 0; i < 5; i++) {
        await service.create({ nis: `${5000 + i}`, nisn: `${5000 + i}`, name: `Siswa ${i}`, gender: "L", classId });
      }
      const result = await service.list({ page: "1", limit: "3" });
      expect(result.data.length).toBe(3);
      expect(result.total).toBeGreaterThanOrEqual(5);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(3);
    });

    it("returns second page correctly", async () => {
      const result = await service.list({ page: "2", limit: "3" });
      expect(result.data.length).toBeGreaterThanOrEqual(1);
      expect(result.page).toBe(2);
    });

    it("filters by classId", async () => {
      // Create another class
      const cls2 = await prisma.class.create({ data: { name: "Kelas 5B", academicYearId: yearId } });
      await service.create({ nis: "6001", nisn: "006001", name: "ClassB Student", gender: "P", classId: cls2.id });

      const result = await service.list({ classId: cls2.id });
      expect(result.data.length).toBe(1);
      expect(result.data[0].name).toBe("ClassB Student");
    });

    it("returns students sorted by name ascending", async () => {
      const result = await service.list({ limit: "100" });
      for (let i = 1; i < result.data.length; i++) {
        expect(result.data[i - 1].name <= result.data[i].name).toBe(true);
      }
    });

    it("includes class relation in each student", async () => {
      const result = await service.list({ limit: "1" });
      if (result.data.length > 0) {
        expect(result.data[0].class).toBeDefined();
        expect(result.data[0].class.name).toBeDefined();
      }
    });
  });

  describe("getById", () => {
    it("returns student with class info", async () => {
      const s = await service.create({ nis: "3001", nisn: "003001", name: "Budi", gender: "L", classId });
      const found = await service.getById(s.id);
      expect(found.name).toBe("Budi");
      expect(found.class.name).toBe("Kelas 5A");
    });

    it("throws NotFoundError for non-existent id", async () => {
      expect(service.getById("nonexistent")).rejects.toThrow();
    });
  });

  describe("update", () => {
    it("updates student name", async () => {
      const s = await service.create({ nis: "4001", nisn: "004001", name: "Budi", gender: "L", classId });
      const updated = await service.update(s.id, { name: "Budi Update" });
      expect(updated.name).toBe("Budi Update");
    });

    it("updates student NIS", async () => {
      const s = await service.create({ nis: "4010", nisn: "004010", name: "NIS Test", gender: "L", classId });
      const updated = await service.update(s.id, { nis: "4010-new" });
      expect(updated.nis).toBe("4010-new");
    });

    it("updates student gender", async () => {
      const s = await service.create({ nis: "4020", nisn: "004020", name: "Gender Test", gender: "L", classId });
      const updated = await service.update(s.id, { gender: "P" });
      expect(updated.gender).toBe("P");
    });

    it("updates student class", async () => {
      const newClass = await prisma.class.create({ data: { name: "Kelas 5C", academicYearId: yearId } });
      const s = await service.create({ nis: "4030", nisn: "004030", name: "Class Move", gender: "L", classId });
      const updated = await service.update(s.id, { classId: newClass.id });
      expect(updated.classId).toBe(newClass.id);
    });

    it("throws NotFoundError for non-existent student", async () => {
      expect(service.update("nonexistent", { name: "X" })).rejects.toThrow();
    });
  });
});
