import { prisma } from "../../lib/prisma";
import { NotFoundError } from "../../common/error";

export async function getStudentProfile(studentId: string) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      class: { select: { id: true, name: true } },
    },
  });
  if (!student) throw new NotFoundError("Student not found");

  const semesterRecords = await prisma.semesterRecord.findMany({
    where: { studentId },
    include: {
      academicYear: { select: { year: true } },
      subjectScores: true,
      attendance: true,
      achievements: true,
      healthRecord: true,
      aiSummaries: {
        where: { isFinal: true },
        select: { summaryType: true, content: true, version: true },
        orderBy: { version: "desc" },
      },
    },
    orderBy: [{ academicYear: { year: "asc" } }, { semester: "asc" }],
  });

  return { student, semesterRecords };
}

export async function getTimeline(studentId: string) {
  const records = await prisma.semesterRecord.findMany({
    where: { studentId },
    include: {
      academicYear: { select: { year: true } },
    },
    orderBy: [{ academicYear: { year: "asc" } }, { semester: "asc" }],
  });

  return records.map((r) => ({
    id: r.id,
    semester: r.semester,
    year: r.academicYear.year,
    label: `Semester ${r.semester === 1 ? "Ganjil" : "Genap"} ${r.academicYear.year}`,
    createdAt: r.createdAt,
  }));
}
