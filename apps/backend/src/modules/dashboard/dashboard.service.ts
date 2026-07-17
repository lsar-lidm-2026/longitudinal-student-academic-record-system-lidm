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
