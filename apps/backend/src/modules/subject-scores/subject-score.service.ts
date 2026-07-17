import { prisma } from "../../lib/prisma";
import { NotFoundError } from "../../common/error";
import { Prisma } from "../../generated/prisma";

export async function upsert(
  semesterRecordId: string,
  data: {
    subjectName: string;
    knowledgeScore: number;
    skillsScore: number;
    notes?: string;
  }
) {
  // Check semester record exists
  const record = await prisma.semesterRecord.findUnique({
    where: { id: semesterRecordId },
  });
  if (!record) throw new NotFoundError("Semester record not found");

  return prisma.subjectScore.upsert({
    where: {
      semesterRecordId_subjectName: {
        semesterRecordId,
        subjectName: data.subjectName,
      },
    },
    update: {
      knowledgeScore: data.knowledgeScore,
      skillsScore: data.skillsScore,
      notes: data.notes || null,
    },
    create: {
      semesterRecordId,
      subjectName: data.subjectName,
      knowledgeScore: data.knowledgeScore,
      skillsScore: data.skillsScore,
      notes: data.notes || null,
    },
  });
}

export async function remove(id: string) {
  const item = await prisma.subjectScore.findUnique({ where: { id } });
  if (!item) throw new NotFoundError("Subject score not found");
  return prisma.subjectScore.delete({ where: { id } });
}
