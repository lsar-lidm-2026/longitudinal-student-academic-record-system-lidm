import { prisma } from "../../lib/prisma";
import type { Role } from "../../generated/prisma";

export async function getSummary(userId: string, role: Role) {
  if (role === "ADMINISTRATOR" || role === "KEPALA_SEKOLAH") {
    const [totalStudents, totalClasses, activeYear, pendingAiDrafts] = await Promise.all([
      prisma.student.count(),
      prisma.class.count(),
      prisma.academicYear.findFirst({ where: { isActive: true } }),
      prisma.aiSummary.count({ where: { isFinal: false } }),
    ]);

    return {
      totalStudents,
      totalClasses,
      activeYear: activeYear?.year || null,
      pendingAiDrafts,
    };
  }

  if (role === "GURU") {
    const managedClasses = await prisma.class.findMany({
      where: { homeroomTeacherId: userId },
      select: { id: true, name: true },
    });

    const classIds = managedClasses.map((c) => c.id);
    const [totalStudents, activeYear, pendingAiDrafts] = await Promise.all([
      prisma.student.count({ where: { classId: { in: classIds } } }),
      prisma.academicYear.findFirst({ where: { isActive: true } }),

      prisma.aiSummary.count({
        where: {
          isFinal: false,
          semesterRecord: {
            student: { classId: { in: classIds } },
          },
        },
      }),
    ]);

    return {
      managedClasses,
      totalStudents,
      activeYear: activeYear?.year || null,
      pendingAiDrafts,
    };
  }

  // OPERATOR
  const [totalStudents, totalClasses, activeYear] = await Promise.all([
    prisma.student.count(),
    prisma.class.count(),
    prisma.academicYear.findFirst({ where: { isActive: true } }),
  ]);

  return { totalStudents, totalClasses, activeYear: activeYear?.year || null };
}

export async function getAdministrativeStatus(userId: string, role: Role) {
  // Determine which classes to check
  let classIds: string[];

  if (role === "ADMINISTRATOR" || role === "KEPALA_SEKOLAH") {
    const allClasses = await prisma.class.findMany({ select: { id: true } });
    classIds = allClasses.map((c) => c.id);
  } else {
    // GURU — only their managed classes
    const managedClasses = await prisma.class.findMany({
      where: { homeroomTeacherId: userId },
      select: { id: true },
    });
    classIds = managedClasses.map((c) => c.id);
  }

  // For each class, count students and check data completeness
  const results = await Promise.all(
    classIds.map(async (classId) => {
      const classInfo = await prisma.class.findUnique({
        where: { id: classId },
        include: {
          academicYear: { select: { year: true } },
          homeroomTeacher: { select: { name: true } },
          _count: { select: { students: true } },
        },
      });

      const students = await prisma.student.findMany({
        where: { classId },
        select: { id: true },
      });

      // Count students with complete data (at least one semester record with scores)
      const totalStudents = students.length;
      const withRecords = await prisma.semesterRecord.count({
        where: { studentId: { in: students.map((s) => s.id) } },
      });
      const withScores = await prisma.subjectScore.count({
        where: {
          semesterRecord: { student: { classId } },
        },
      });
      const pendingAiDrafts = await prisma.aiSummary.count({
        where: {
          isFinal: false,
          semesterRecord: { student: { classId } },
        },
      });

      return {
        classId,
        className: classInfo?.name || "Unknown",
        academicYear: classInfo?.academicYear.year || "",
        homeroomTeacher: classInfo?.homeroomTeacher?.name || "Belum di-assign",
        totalStudents,
        totalRecords: withRecords,
        totalScores: withScores,
        pendingAiDrafts,
        completeness:
          totalStudents > 0
            ? Math.min(Math.round((withRecords / totalStudents) * 100), 100)
            : 0,
      };
    })
  );

  return results;
}
