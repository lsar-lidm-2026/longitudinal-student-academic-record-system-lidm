import { prisma } from "../../lib/prisma";
import { NotFoundError } from "../../common/error";
import { computeFeatures } from "./features";
import { assessRisk, trendSummary, assessClassRisk } from "./rules";
import type { RiskLevel, RiskAssessment } from "./rules";

export async function getStudentRisk(studentId: string): Promise<{
  features: any;
  risk: RiskAssessment;
  trend: any;
}> {
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) throw new NotFoundError("Student not found");

  const features = await computeFeatures(studentId);
  const risk = assessRisk(features);
  const trend = trendSummary(features);

  // Save to PredictedOutcome
  await prisma.predictedOutcome.upsert({
    where: {
      studentId_academicYearId_modelType_isActive: {
        studentId,
        academicYearId: features.academicYearId || "",
        modelType: "RISK_CLASSIFICATION",
        isActive: true,
      },
    },
    update: {
      label: risk.level,
      score: risk.score,
      features: features as any,
      isActive: true,
    },
    create: {
      studentId,
      academicYearId: features.academicYearId || null,
      modelType: "RISK_CLASSIFICATION",
      label: risk.level,
      score: risk.score,
      features: features as any,
      isActive: true,
    },
  });

  return { features, risk, trend };
}

export async function getClassRisk(classId: string) {
  const students = await prisma.student.findMany({
    where: { classId },
    select: { id: true, name: true },
  });

  const results = [];

  for (const student of students) {
    const features = await computeFeatures(student.id);
    const risk = assessRisk(features);
    const trend = trendSummary(features);
    results.push({
      studentId: student.id,
      name: student.name,
      risk,
      trend,
    });
  }

  // Sort by risk score descending
  results.sort((a, b) => b.risk.score - a.risk.score);

  const summary = {
    total: results.length,
    kritis: results.filter((r) => r.risk.level === "KRITIS").length,
    waspada: results.filter((r) => r.risk.level === "WASPADA").length,
    aman: results.filter((r) => r.risk.level === "AMAN").length,
    kritisStudents: results
      .filter((r) => r.risk.level === "KRITIS")
      .map((r) => ({ id: r.studentId, name: r.name, score: r.risk.score })),
  };

  return { results, summary };
}

export async function getStudentTrend(studentId: string) {
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) throw new NotFoundError("Student not found");

  const features = await computeFeatures(studentId);
  const trend = trendSummary(features);

  // Save trend prediction
  if (features.academicYearId) {
    await prisma.predictedOutcome.upsert({
      where: {
        studentId_academicYearId_modelType_isActive: {
          studentId,
          academicYearId: features.academicYearId,
          modelType: "TREND_PREDICTION",
          isActive: true,
        },
      },
      update: {
        score: features.avgKnowledge,
        features: features as any,
        isActive: true,
      },
      create: {
        studentId,
        academicYearId: features.academicYearId,
        modelType: "TREND_PREDICTION",
        score: features.avgKnowledge,
        features: features as any,
        isActive: true,
      },
    });
  }

  return { features, trend };
}

export async function getModels() {
  return prisma.mlModel.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export async function getOutcomes(studentId?: string) {
  const where = studentId ? { studentId } : {};
  return prisma.predictedOutcome.findMany({
    where: { ...where, isActive: true },
    include: {
      student: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}
