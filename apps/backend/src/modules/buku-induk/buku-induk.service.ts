import { prisma } from "../../lib/prisma";
import { NotFoundError } from "../../common/error";
import { Prisma } from "../../generated/prisma/client";

export async function getPreview(studentId: string) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      class: { select: { name: true } },
    },
  });
  if (!student) throw new NotFoundError("Student not found");

  const records = await prisma.semesterRecord.findMany({
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

  return {
    biodata: {
      nis: student.nis,
      nisn: student.nisn,
      name: student.name,
      gender: student.gender,
      className: student.class.name,
      photoUrl: student.photoUrl,
    },
    semesterRecords: records.map(
      (r: Prisma.SemesterRecordGetPayload<{
        include: {
          academicYear: { select: { year: true } };
          subjectScores: true;
          attendance: true;
          achievements: true;
          healthRecord: true;
        };
      }>) => ({
        year: r.academicYear.year,
        semester: r.semester,
        subjectScores: r.subjectScores,
        attendance: r.attendance,
        achievements: r.achievements,
        healthRecord: r.healthRecord,
      })
    ),
  };
}

export async function getValidationStatus(studentId: string) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true },
  });
  if (!student) throw new NotFoundError("Student not found");

  const records = await prisma.semesterRecord.findMany({
    where: { studentId },
    include: {
      academicYear: { select: { year: true } },
      _count: { select: { subjectScores: true } },
      attendance: { select: { id: true } },
      healthRecord: { select: { id: true } },
    },
    orderBy: [{ academicYear: { year: "asc" } }, { semester: "asc" }],
  });

  return records.map(
    (r: Prisma.SemesterRecordGetPayload<{
      include: {
        academicYear: { select: { year: true } };
        _count: { select: { subjectScores: true } };
        attendance: { select: { id: true } };
        healthRecord: { select: { id: true } };
      };
    }>) => ({
      year: r.academicYear.year,
      semester: r.semester,
      status: {
        subjectScores: r._count.subjectScores > 0 ? "complete" : "incomplete",
        attendance: r.attendance ? "complete" : "incomplete",
        healthRecord: r.healthRecord ? "complete" : "incomplete",
      },
    })
  );
}

export async function getWorkspace(studentId: string) {
  const preview = await getPreview(studentId);
  const validation = await getValidationStatus(studentId);

  return {
    preview,
    validation,
    generatedAt: new Date().toISOString(),
  };
}
