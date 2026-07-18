import { describe, expect, it, beforeAll } from "bun:test";
import { cleanDb, prisma } from "./setup";
import * as service from "../src/modules/academic-years/academic-year.service";

describe("AcademicYear list", () => {
  beforeAll(async () => { await cleanDb(); });

  it("returns empty when no years", async () => {
    const years = await service.list();
    expect(years).toEqual([]);
  });

  it("returns all years ordered descending", async () => {
    await service.create({ year: "2023/2024" });
    await service.create({ year: "2024/2025" });
    await service.create({ year: "2025/2026" });
    const years = await service.list();
    expect(years.length).toBe(3);
    expect(years[0].year).toBe("2025/2026"); // newest first
    expect(years[2].year).toBe("2023/2024"); // oldest last
  });
});

describe("AcademicYear create", () => {
  beforeAll(async () => { await cleanDb(); });

  it("creates a new academic year with default isActive false", async () => {
    const year = await service.create({ year: "2026/2027" });
    expect(year.year).toBe("2026/2027");
    expect(year.isActive).toBe(false);
    expect(year.isArchived).toBe(false);
  });

  it("rejects duplicate year", async () => {
    await service.create({ year: "2030/2031" });
    expect(service.create({ year: "2030/2031" })).rejects.toThrow();
  });
});

describe("AcademicYear update", () => {
  beforeAll(async () => { await cleanDb(); });

  it("updates year string", async () => {
    const year = await service.create({ year: "2023/2024" });
    const updated = await service.update(year.id, { year: "2023/2025" });
    expect(updated.year).toBe("2023/2025");
  });

  it("throws NotFoundError for non-existent year", async () => {
    expect(service.update("nonexistent", { year: "2030/2031" })).rejects.toThrow();
  });
});

describe("AcademicYear activate", () => {
  beforeAll(async () => { await cleanDb(); });

  it("activates target and deactivates others", async () => {
    const y1 = await service.create({ year: "2024/2025" });
    const y2 = await service.create({ year: "2025/2026" });
    await service.activate(y2.id);

    const all = await service.list();
    const active = all.filter((y: any) => y.isActive);
    expect(active.length).toBe(1);
    expect(active[0].year).toBe("2025/2026");

    // Verify y1 is deactivated
    const deactivated = all.find((y: any) => y.year === "2024/2025");
    expect(deactivated.isActive).toBe(false);
  });

  it("switches active year when another is activated", async () => {
    const y1 = await service.create({ year: "2026/2027" });
    const y2 = await service.create({ year: "2027/2028" });
    await service.activate(y1.id);
    await service.activate(y2.id);

    const active = (await service.list()).filter((y: any) => y.isActive);
    expect(active.length).toBe(1);
    expect(active[0].year).toBe("2027/2028");
  });

  it("sets isArchived false when activating an archived year", async () => {
    const year = await service.create({ year: "2028/2029" });
    await service.archive(year.id);
    await service.activate(year.id);
    const active = (await service.list()).find((y: any) => y.id === year.id);
    expect(active.isActive).toBe(true);
    expect(active.isArchived).toBe(false);
  });

  it("throws NotFoundError for non-existent year", async () => {
    expect(service.activate("nonexistent")).rejects.toThrow();
  });
});

describe("AcademicYear archive", () => {
  beforeAll(async () => { await cleanDb(); });

  it("archives a year", async () => {
    const year = await service.create({ year: "2023/2024" });
    await service.archive(year.id);
    const archived = await service.getById(year.id);
    expect(archived.isArchived).toBe(true);
    expect(archived.isActive).toBe(false);
  });

  it("archiving twice is idempotent", async () => {
    const year = await service.create({ year: "2024/2025" });
    await service.archive(year.id);
    await service.archive(year.id); // should not throw
    const archived = await service.getById(year.id);
    expect(archived.isArchived).toBe(true);
  });

  it("throws NotFoundError for non-existent year", async () => {
    expect(service.archive("nonexistent")).rejects.toThrow();
  });
});

describe("AcademicYear getById", () => {
  beforeAll(async () => { await cleanDb(); });

  it("returns year by id", async () => {
    const year = await service.create({ year: "2025/2026" });
    const found = await service.getById(year.id);
    expect(found.year).toBe("2025/2026");
  });

  it("throws NotFoundError for non-existent id", async () => {
    expect(service.getById("nonexistent")).rejects.toThrow();
  });
});
