import { prisma } from "../../lib/prisma";
import { NotFoundError } from "../../common/error";

export async function upsert(
  semesterRecordId: string,
  data: { sick: number; permission: number; absent: number }
) {
  const record = await prisma.semesterRecord.findUnique({
    where: { id: semesterRecordId },
  });
  if (!record) throw new NotFoundError("Semester record not found");

  return prisma.attendance.upsert({
    where: { semesterRecordId },
    update: {
      sick: data.sick,
      permission: data.permission,
      absent: data.absent,
    },
    create: {
      semesterRecordId,
      sick: data.sick,
      permission: data.permission,
      absent: data.absent,
    },
  });
}
