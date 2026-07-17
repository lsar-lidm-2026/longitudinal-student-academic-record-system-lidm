import { describe, expect, it } from "bun:test";

const sampleData = {
  name: "Ahmad",
  className: "Kelas 5A",
  semester: 1,
  academicYear: "2025/2026",
  subjectScores: [
    { subjectName: "Matematika", knowledgeScore: 85, skillsScore: 80 },
    { subjectName: "IPA", knowledgeScore: 90, skillsScore: 88 },
  ],
  attendance: { sick: 2, permission: 1, absent: 0 },
  achievements: [{ title: "Juara Kelas", type: "Akademik" }],
};

describe("AI Prompts", () => {
  describe("buildStudentSummaryPrompt", () => {
    it("includes student name and scores", async () => {
      const { buildStudentSummaryPrompt } = await import("../src/modules/ai/prompts");
      const prompt = buildStudentSummaryPrompt(sampleData);
      expect(prompt).toContain("Ahmad");
      expect(prompt).toContain("Matematika");
      expect(prompt).toContain("IPA");
    });

    it("includes attendance and achievements", async () => {
      const { buildStudentSummaryPrompt } = await import("../src/modules/ai/prompts");
      const prompt = buildStudentSummaryPrompt(sampleData);
      expect(prompt).toContain("Sakit: 2");
      expect(prompt).toContain("Juara Kelas");
    });

    it("handles missing data", async () => {
      const { buildStudentSummaryPrompt } = await import("../src/modules/ai/prompts");
      const noAtt = buildStudentSummaryPrompt({ ...sampleData, attendance: null });
      expect(noAtt).toContain("Tidak ada data kehadiran");
      const noAch = buildStudentSummaryPrompt({ ...sampleData, achievements: [] });
      expect(noAch).toContain("Tidak ada prestasi");
    });
  });

  describe("buildDraftDescriptionPrompt", () => {
    it("includes scores and format requirement", async () => {
      const { buildDraftDescriptionPrompt } = await import("../src/modules/ai/prompts");
      const prompt = buildDraftDescriptionPrompt(sampleData);
      expect(prompt).toContain("Ahmad");
      expect(prompt).toContain("Matematika");
      expect(prompt).toContain("**{Mata Pelajaran}**");
    });
  });

  describe("buildTransitionSummaryPrompt", () => {
    it("includes all semesters and format markers", async () => {
      const { buildTransitionSummaryPrompt } = await import("../src/modules/ai/prompts");
      const prompt = buildTransitionSummaryPrompt([sampleData]);
      expect(prompt).toContain("Ahmad");
      expect(prompt).toContain("Semester Ganjil");
      expect(prompt).toContain("Profil Singkat");
      expect(prompt).toContain("Catatan Penting");
    });
  });
});
