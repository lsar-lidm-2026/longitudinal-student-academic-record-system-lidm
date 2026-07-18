import { prisma } from "../../lib/prisma";
import { ConflictError, NotFoundError } from "../../common/error";
import { parsePagination, buildPagination } from "../../common/pagination";

export async function list(query: { page?: string; limit?: string; classId?: string; search?: string }) {
  const { page, limit } = parsePagination(query);
  const where: any = query.classId ? { classId: query.classId } : {};
  if (query.search) {
    where.name = { contains: query.search, mode: "insensitive" };
  }

  const [data, total] = await Promise.all([
    prisma.student.findMany({
      where,
      include: {
        class: {
          select: { id: true, name: true },
        },
      },
      orderBy: { name: "asc" },
      ...buildPagination(page, limit),
    }),
    prisma.student.count({ where }),
  ]);

  return { data, page, limit, total };
}

export async function getById(id: string) {
  const item = await prisma.student.findUnique({
    where: { id },
    include: {
      class: {
        select: { id: true, name: true },
      },
    },
  });
  if (!item) throw new NotFoundError("Student not found");
  return item;
}

export async function create(data: {
  nis: string;
  nisn: string;
  name: string;
  gender: string;
  classId: string;
}) {
  const classExists = await prisma.class.findUnique({ where: { id: data.classId } });
  if (!classExists) throw new NotFoundError("Class not found");

  const existingNis = await prisma.student.findUnique({ where: { nis: data.nis } });
  if (existingNis) throw new ConflictError("NIS already exists");

  const existingNisn = await prisma.student.findUnique({ where: { nisn: data.nisn } });
  if (existingNisn) throw new ConflictError("NISN already exists");

  return prisma.student.create({ data });
}

export async function update(
  id: string,
  data: { nis?: string; nisn?: string; name?: string; gender?: string; classId?: string }
) {
  await getById(id);
  if (data.classId) {
    const classExists = await prisma.class.findUnique({ where: { id: data.classId } });
    if (!classExists) throw new NotFoundError("Class not found");
  }
  return prisma.student.update({ where: { id }, data });
}
