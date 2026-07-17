import { prisma } from "../../lib/prisma";
import { NotFoundError } from "../../common/error";

export async function create(data: {
  semesterRecordId: string;
  title: string;
  type: string;
  description?: string;
}) {
  const record = await prisma.semesterRecord.findUnique({
    where: { id: data.semesterRecordId },
  });
  if (!record) throw new NotFoundError("Semester record not found");

  return prisma.achievement.create({ data });
}

export async function update(
  id: string,
  data: { title?: string; type?: string; description?: string }
) {
  const item = await prisma.achievement.findUnique({ where: { id } });
  if (!item) throw new NotFoundError("Achievement not found");

  return prisma.achievement.update({ where: { id }, data });
}

export async function remove(id: string) {
  const item = await prisma.achievement.findUnique({ where: { id } });
  if (!item) throw new NotFoundError("Achievement not found");

  return prisma.achievement.delete({ where: { id } });
}
