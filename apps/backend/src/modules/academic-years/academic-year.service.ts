import { prisma } from "../../lib/prisma";
import { ConflictError, NotFoundError } from "../../common/error";

export async function list() {
  return prisma.academicYear.findMany({
    orderBy: { year: "desc" },
  });
}

export async function getById(id: string) {
  const item = await prisma.academicYear.findUnique({ where: { id } });
  if (!item) throw new NotFoundError("Academic year not found");
  return item;
}

export async function create(data: { year: string }) {
  const existing = await prisma.academicYear.findUnique({
    where: { year: data.year },
  });
  if (existing) throw new ConflictError("Academic year already exists");

  return prisma.academicYear.create({
    data: { year: data.year },
  });
}

export async function update(id: string, data: { year?: string }) {
  await getById(id);
  return prisma.academicYear.update({
    where: { id },
    data,
  });
}

export async function activate(id: string) {
  await getById(id);
  // Transaction: deactivate all, activate one
  return prisma.$transaction([
    prisma.academicYear.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    }),
    prisma.academicYear.update({
      where: { id },
      data: { isActive: true, isArchived: false },
    }),
  ]);
}

export async function archive(id: string) {
  await getById(id);
  return prisma.academicYear.update({
    where: { id },
    data: { isArchived: true, isActive: false },
  });
}
