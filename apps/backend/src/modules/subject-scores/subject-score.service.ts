import { prisma } from "../../lib/prisma";
import { NotFoundError } from "../../common/error";
import { Prisma } from "../../generated/prisma/client";

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

export async function update(
  id: string,
  data: {
    subjectName?: string;
    knowledgeScore?: number;
    skillsScore?: number;
    notes?: string;
  }
) {
  const item = await prisma.subjectScore.findUnique({ where: { id } });
  if (!item) throw new NotFoundError("Subject score not found");
  return prisma.subjectScore.update({ where: { id }, data });
}

export async function remove(id: string) {
  const item = await prisma.subjectScore.findUnique({ where: { id } });
  if (!item) throw new NotFoundError("Subject score not found");
  return prisma.subjectScore.delete({ where: { id } });
}

/**
 * Batch upsert multiple subject scores in a single transaction.
 */
export async function batchUpsert(
  semesterRecordId: string,
  scores: Array<{
    subjectName: string;
    knowledgeScore: number;
    skillsScore: number;
    notes?: string;
  }>
) {
  const record = await prisma.semesterRecord.findUnique({
    where: { id: semesterRecordId },
  });
  if (!record) throw new NotFoundError("Semester record not found");

  return prisma.$transaction(
    scores.map((score) =>
      prisma.subjectScore.upsert({
        where: {
          semesterRecordId_subjectName: {
            semesterRecordId,
            subjectName: score.subjectName,
          },
        },
        update: {
          knowledgeScore: score.knowledgeScore,
          skillsScore: score.skillsScore,
          notes: score.notes || null,
        },
        create: {
          semesterRecordId,
          subjectName: score.subjectName,
          knowledgeScore: score.knowledgeScore,
          skillsScore: score.skillsScore,
          notes: score.notes || null,
        },
      })
    )
  );
}
