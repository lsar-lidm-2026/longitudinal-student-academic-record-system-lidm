import { prisma } from "../../lib/prisma";
import { NotFoundError } from "../../common/error";

export async function upsert(
  semesterRecordId: string,
  data: {
    height?: number;
    weight?: number;
    hearingCondition?: string;
    visionCondition?: string;
    teethCondition?: string;
  }
) {
  const record = await prisma.semesterRecord.findUnique({
    where: { id: semesterRecordId },
  });
  if (!record) throw new NotFoundError("Semester record not found");

  return prisma.healthRecord.upsert({
    where: { semesterRecordId },
    update: data,
    create: {
      semesterRecordId,
      ...data,
    },
  });
}
