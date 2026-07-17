import { describe, expect, it, beforeAll } from "bun:test";
import { cleanDb } from "./setup";
import * as service from "../src/modules/academic-years/academic-year.service";

describe("AcademicYear list", () => {
  beforeAll(async () => { await cleanDb(); });

  it("returns empty when no years", async () => {
    const years = await service.list();
    expect(years).toEqual([]);
  });

  it("returns all years", async () => {
    await service.create({ year: "2023/2024" });
    await service.create({ year: "2024/2025" });
    await service.create({ year: "2025/2026" });
    const years = await service.list();
    expect(years.length).toBe(3);
  });
});

describe("AcademicYear create", () => {
  beforeAll(async () => { await cleanDb(); });

  it("creates a new academic year", async () => {
    const year = await service.create({ year: "2026/2027" });
    expect(year.year).toBe("2026/2027");
  });

  it("rejects duplicate year", async () => {
    await service.create({ year: "2030/2031" });
    expect(service.create({ year: "2030/2031" })).rejects.toThrow();
  });
});

describe("AcademicYear activate", () => {
  beforeAll(async () => { await cleanDb(); });

  it("activates target and deactivates others", async () => {
    const y1 = await service.create({ year: "2024/2025" });
    const y2 = await service.create({ year: "2025/2026" });
    await service.activate(y2.id);
    const active = (await service.list()).filter((y: any) => y.isActive);
    expect(active.length).toBe(1);
    expect(active[0].year).toBe("2025/2026");
  });
});

describe("AcademicYear archive", () => {
  beforeAll(async () => { await cleanDb(); });

  it("archives a year", async () => {
    const year = await service.create({ year: "2023/2024" });
    await service.archive(year.id);
    const archived = await service.getById(year.id);
    expect(archived.isArchived).toBe(true);
  });
});
