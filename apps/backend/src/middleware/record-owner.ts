import { Elysia } from "elysia";
import { ForbiddenError, NotFoundError } from "../common/error";
import { prisma } from "../lib/prisma";
import { requireAuth } from "./auth";

/**
 * Middleware untuk route dimana params.id adalah SemesterRecord ID.
 * Resolve studentId dari SemesterRecord, lalu validasi homeroom access.
 */
export const requireRecordOwner = new Elysia({ name: "requireRecordOwner" })
  .use(requireAuth)
  .derive({ as: "scoped" }, async ({ params, user }) => {
    if (!user) throw new ForbiddenError();

    // Admin, Kepsek, dan Operator punya akses global
    if (["ADMINISTRATOR", "KEPALA_SEKOLAH", "OPERATOR_SEKOLAH"].includes(user.role)) {
      return {};
    }

    // GURU — validasi apakah dia wali kelas dari siswa pemilik record ini
    const semesterRecordId = (params as { id?: string }).id;
    if (!semesterRecordId) throw new ForbiddenError("Semester record ID required");

    const record = await prisma.semesterRecord.findUnique({
      where: { id: semesterRecordId },
      select: {
        student: {
          select: {
            classId: true,
            class: { select: { homeroomTeacherId: true } },
          },
        },
      },
    });

    if (!record) throw new NotFoundError("Semester record not found");
    if (record.student.class.homeroomTeacherId !== user.userId) {
      throw new ForbiddenError("You are not the homeroom teacher of this student");
    }

    return {};
  });
