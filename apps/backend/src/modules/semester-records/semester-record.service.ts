import { prisma } from "../../lib/prisma";
import { NotFoundError, ConflictError } from "../../common/error";

export async function create(data: {
  studentId: string;
  academicYearId: string;
  semester: number;
  createdById: string;
}) {
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
  return prisma.semesterRecord.delete({ where: { id } });
}
