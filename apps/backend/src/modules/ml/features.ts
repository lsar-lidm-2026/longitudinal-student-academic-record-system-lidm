import { prisma } from "../../lib/prisma";

export interface StudentFeatures {
  studentId: string;
  avgKnowledge: number;
  avgSkills: number;
  scoreVolatility: number;
  scoreDelta: number; // perubahan nilai semester terakhir
  totalAbsence: number;
  absenceTrend: number;
  achievementCount: number;
  semesterCount: number;
  academicYearId?: string;
}

/**
 * Compute feature vector for a single student based on ALL semester records.
 */
export async function computeFeatures(studentId: string): Promise<StudentFeatures> {
  const records = await prisma.semesterRecord.findMany({
    where: { studentId },
    include: {
      subjectScores: true,
      attendance: true,
      achievements: true,
      academicYear: { select: { year: true } },
    },
    orderBy: [{ academicYear: { year: "asc" } }, { semester: "asc" }],
  });

  if (records.length === 0) {
    return {
      studentId,
      avgKnowledge: 0,
      avgSkills: 0,
      scoreVolatility: 0,
      scoreDelta: 0,
      totalAbsence: 0,
      absenceTrend: 0,
      achievementCount: 0,
      semesterCount: 0,
    };
  }

  // Rata-rata nilai semua semester
  const allScores = records.flatMap((r) => r.subjectScores);
  const avgKnowledge =
    allScores.length > 0
      ? allScores.reduce((s, sc) => s + sc.knowledgeScore, 0) / allScores.length
      : 0;
  const avgSkills =
    allScores.length > 0
      ? allScores.reduce((s, sc) => s + sc.skillsScore, 0) / allScores.length
      : 0;

  // Volatilitas nilai (standar deviasi rata-rata per semester)
  const semesterAvgs = records.map((r) => {
    const scores = r.subjectScores;
    return scores.length > 0
      ? scores.reduce((s, sc) => s + sc.knowledgeScore, 0) / scores.length
      : 0;
  });
  const mean = semesterAvgs.reduce((s, v) => s + v, 0) / semesterAvgs.length;
  const variance =
    semesterAvgs.reduce((s, v) => s + (v - mean) ** 2, 0) / semesterAvgs.length;
  const scoreVolatility = Math.sqrt(variance);

  // Delta nilai (perubahan semester terakhir)
  const scoreDelta =
    semesterAvgs.length >= 2
      ? semesterAvgs[semesterAvgs.length - 1] - semesterAvgs[semesterAvgs.length - 2]
      : 0;

  // Kehadiran
  const attendances = records.filter((r) => r.attendance);
  const totalAbsence = attendances.reduce(
    (s, r) => s + r.attendance!.sick + r.attendance!.permission + r.attendance!.absent,
    0
  );
  const absenceTrend =
    attendances.length >= 2
      ? (attendances[attendances.length - 1]!.attendance!.absent) -
        (attendances[attendances.length - 2]!.attendance!.absent)
      : 0;

  // Prestasi
  const achievementCount = records.reduce((s, r) => s + r.achievements.length, 0);

  return {
    studentId,
    avgKnowledge: Math.round(avgKnowledge * 100) / 100,
    avgSkills: Math.round(avgSkills * 100) / 100,
    scoreVolatility: Math.round(scoreVolatility * 100) / 100,
    scoreDelta: Math.round(scoreDelta * 100) / 100,
    totalAbsence,
    absenceTrend,
    achievementCount,
    semesterCount: records.length,
    academicYearId: records[records.length - 1]?.academicYearId,
  };
}
