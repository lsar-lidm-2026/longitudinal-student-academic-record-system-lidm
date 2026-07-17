import { prisma } from "../../lib/prisma";
import { NotFoundError } from "../../common/error";

export async function list() {
  return prisma.class.findMany({
    include: {
      academicYear: { select: { year: true } },
      homeroomTeacher: { select: { id: true, name: true } },
      _count: { select: { students: true } },
    },
    orderBy: [{ academicYear: { year: "desc" } }, { name: "asc" }],
  });
}

export async function getById(id: string) {
  const item = await prisma.class.findUnique({
    where: { id },
    include: {
      academicYear: true,
      homeroomTeacher: { select: { id: true, name: true } },
      _count: { select: { students: true } },
    },
  });
  if (!item) throw new NotFoundError("Class not found");
  return item;
}

export async function create(data: {
  name: string;
  academicYearId: string;
}) {
  return prisma.class.create({ data });
}

export async function getStudents(classId: string) {
  return prisma.student.findMany({
    where: { classId },
    orderBy: { name: "asc" },
  });
}

export async function assignTeacher(classId: string, teacherId: string, changedBy: string) {
  const cls = await getById(classId);
  const previousTeacherId = cls.homeroomTeacher?.id || null;

  return prisma.$transaction(async (tx) => {
    // Update class
    const updated = await tx.class.update({
      where: { id: classId },
      data: { homeroomTeacherId: teacherId },
    });

    // Create audit log
    await tx.classAuditLog.create({
      data: {
        classId,
        previousTeacherId,
        newTeacherId: teacherId,
        changedById: changedBy,
      },
    });

    return updated;
  });
}
