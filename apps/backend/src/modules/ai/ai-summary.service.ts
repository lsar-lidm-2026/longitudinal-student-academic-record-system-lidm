import { prisma } from "../../lib/prisma";
import { NotFoundError } from "../../common/error";

export async function getBySemesterRecord(semesterRecordId: string) {
  return prisma.aiSummary.findMany({
    where: { semesterRecordId },
    orderBy: [{ version: "desc" }],
  });
}

export async function update(id: string, data: { isFinal?: boolean; content?: string }) {
  const existing = await prisma.aiSummary.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("AI Summary not found");

  return prisma.aiSummary.update({
    where: { id },
    data: {
      ...(data.isFinal !== undefined ? { isFinal: data.isFinal } : {}),
      ...(data.content !== undefined ? { content: data.content } : {}),
    },
  });
}

export async function remove(id: string) {
  const existing = await prisma.aiSummary.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("AI Summary not found");

  return prisma.aiSummary.delete({ where: { id } });
}
