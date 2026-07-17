import { Elysia } from "elysia";
import { ForbiddenError, NotFoundError } from "../common/error";
import { prisma } from "../lib/prisma";
import { requireAuth } from "./auth";

export const requireHomeroomAccess = new Elysia({ name: "requireHomeroomAccess" })
  .use(requireAuth)
  .derive({ as: "scoped" }, async ({ request, user, params }) => {
    if (!user) throw new ForbiddenError();

    // Admin dan Kepsek punya akses global
    if (user.role === "ADMINISTRATOR" || user.role === "KEPALA_SEKOLAH") {
      return {};
    }

    // Operator hanya akses untuk management data (tidak perlu homeroom check)
    if (user.role === "OPERATOR_SEKOLAH") {
      return {};
    }

    // Guru harus divalidasi: apakah dia wali kelas dari siswa ini?
    const studentId = (params as { id?: string }).id;
    if (!studentId) throw new ForbiddenError("Student ID required");

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: {
        classId: true,
        class: { select: { homeroomTeacherId: true } },
      },
    });

    if (!student) throw new NotFoundError("Student not found");
    if (student.class.homeroomTeacherId !== user.userId) {
      throw new ForbiddenError("You are not the homeroom teacher of this student");
    }

    return {};
  });
