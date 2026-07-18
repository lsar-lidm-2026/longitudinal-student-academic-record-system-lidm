import { prisma } from "../../lib/prisma";
import { NotFoundError, ConflictError } from "../../common/error";

export async function create(data: {
  studentId: string;
  academicYearId: string;
  semester: number;
  createdById: string;
}) {
  const studentExists = await prisma.student.findUnique({ where: { id: data.studentId } });
  if (!studentExists) throw new NotFoundError("Student not found");

  // Check for duplicate
  const existing = await prisma.semesterRecord.findUnique({
    where: {
      studentId_academicYearId_semester: {
        studentId: data.studentId,
        academicYearId: data.academicYearId,
        semester: data.semester,
      },
    },
  });
  if (existing) throw new ConflictError("Semester record already exists for this student");

  return prisma.semesterRecord.create({
    data: {
      studentId: data.studentId,
      academicYearId: data.academicYearId,
      semester: data.semester,
      createdById: data.createdById,
    },
    include: {
      subjectScores: true,
      attendance: true,
      achievements: true,
      healthRecord: true,
    },
  });
}

export async function getById(id: string) {
  const item = await prisma.semesterRecord.findUnique({
    where: { id },
    include: {
      student: { select: { id: true, name: true } },
      academicYear: { select: { year: true } },
      creator: { select: { id: true, name: true } },
      subjectScores: true,
      attendance: true,
      achievements: true,
      healthRecord: true,
      aiSummaries: true,
    },
  });
  if (!item) throw new NotFoundError("Semester record not found");
  return item;
}

export async function update(id: string, data: { academicYearId?: string; semester?: number }) {
  await getById(id);
  return prisma.semesterRecord.update({
    where: { id },
    data,
    include: {
      student: { select: { id: true, name: true } },
      academicYear: { select: { year: true } },
      creator: { select: { id: true, name: true } },
      subjectScores: true,
      attendance: true,
      achievements: true,
      healthRecord: true,
      aiSummaries: true,
    },
  });
}

export async function listByStudent(studentId: string) {
  return prisma.semesterRecord.findMany({
    where: { studentId },
    include: {
      academicYear: { select: { year: true } },
      subjectScores: true,
      attendance: true,
      achievements: true,
      healthRecord: true,
    },
    orderBy: [{ academicYear: { year: "asc" } }, { semester: "asc" }],
  });
}

export async function deleteRecord(id: string) {
  await getById(id);
  await prisma.$transaction([
    prisma.subjectScore.deleteMany({ where: { semesterRecordId: id } }),
    prisma.attendance.deleteMany({ where: { semesterRecordId: id } }),
    prisma.achievement.deleteMany({ where: { semesterRecordId: id } }),
    prisma.healthRecord.deleteMany({ where: { semesterRecordId: id } }),
    prisma.aiSummary.deleteMany({ where: { semesterRecordId: id } }),
    prisma.semesterRecord.delete({ where: { id } }),
  ]);
}
