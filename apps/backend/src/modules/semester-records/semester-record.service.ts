/**
 * SEMESTER RECORD SERVICE
 * =======================
 *
 * Cara kerja file ini:
 * Service layer untuk resource SemesterRecord. Mengelola siklus hidup
 * semester record siswa termasuk pembuatan (dengan cek duplikat),
 * query detail (dengan semua relasi), update, list per siswa,
 * dan penghapusan kaskade (cascade delete) via Prisma transaction.
 *
 * Alur lengkap per fungsi:
 *
 * 1. create(data)
 *    - Validasi studentId: pastikan student exists
 *    - Cek duplikat: composite unique [studentId + academicYearId + semester]
 *      → throw ConflictError jika sudah ada
 *    - Prisma.semesterRecord.create dengan include semua sub-relasi
 *    - Return record lengkap dengan subjectScores, attendance, achievements, healthRecord
 *
 * 2. getById(id)
 *    - findUnique with include: student, academicYear, creator, subjectScores,
 *      attendance, achievements, healthRecord, aiSummaries
 *    - Throw NotFoundError jika tidak ditemukan
 *    - Return record lengkap
 *
 * 3. update(id, data)
 *    - getById(id) untuk memastikan record exists
 *    - Prisma.semesterRecord.update dengan partial data
 *    - Return record lengkap dengan semua relasi
 *
 * 4. listByStudent(studentId)
 *    - findMany by studentId dengan include academicYear + sub-resources
 *    - Order by academic year asc, then semester asc
 *    - Return array of semester records
 *
 * 5. deleteRecord(id)
 *    - getById(id) untuk memastikan record exists
 *    - Prisma.$transaction untuk cascade delete:
 *      1. Hapus semua subjectScore
 *      2. Hapus attendance
 *      3. Hapus achievements
 *      4. Hapus healthRecord
 *      5. Hapus aiSummaries
 *      6. Hapus semesterRecord itu sendiri
 */

import { prisma } from "../../lib/prisma";
import { NotFoundError, ConflictError } from "../../common/error";
import logger from "../../lib/logger";

/**
 * Create a new semester record with duplicate checking.
 * @param data - Object containing studentId, academicYearId, semester, createdById
 * @throws NotFoundError if student does not exist
 * @throws ConflictError if record for same student+year+semester already exists
 */
export async function create(data: {
  studentId: string;
  academicYearId: string;
  semester: number;
  createdById: string;
}) {
  logger.info({ data }, "Semester record service: creating record");

  // Validate that the referenced student exists
  const studentExists = await prisma.student.findUnique({ where: { id: data.studentId } });
  if (!studentExists) {
    logger.warn({ studentId: data.studentId }, "Student not found for semester record creation");
    throw new NotFoundError("Student not found");
  }

  // Check for duplicate semester record (composite unique constraint)
  const existing = await prisma.semesterRecord.findUnique({
    where: {
      studentId_academicYearId_semester: {
        studentId: data.studentId,
        academicYearId: data.academicYearId,
        semester: data.semester,
      },
    },
  });
  if (existing) {
    logger.warn({ studentId: data.studentId, academicYearId: data.academicYearId, semester: data.semester }, "Duplicate semester record");
    throw new ConflictError("Semester record already exists for this student");
  }

  const record = await prisma.semesterRecord.create({
    data: {
      studentId: data.studentId,
      academicYearId: data.academicYearId,
      semester: data.semester,
      createdById: data.createdById,
    },
    include: {
      // Include all sub-resources for immediate access
      subjectScores: true,
      attendance: true,
      achievements: true,
      healthRecord: true,
    },
  });
  logger.info({ recordId: record.id, studentId: data.studentId }, "Semester record created successfully");
  return record;
}

/**
 * Get a single semester record by ID with all related data.
 * @param id - SemesterRecord UUID
 * @throws NotFoundError if record does not exist
 */
export async function getById(id: string) {
  logger.debug({ recordId: id }, "Semester record service: get by ID");
  const item = await prisma.semesterRecord.findUnique({
    where: { id },
    include: {
      // Include related entities for full detail view
      student: { select: { id: true, name: true } },
      academicYear: { select: { year: true } },
      creator: { select: { id: true, name: true } },
      subjectScores: true,
      attendance: true,
      achievements: true,
      healthRecord: true,
      aiSummaries: true,
    },
  });
  if (!item) {
    logger.warn({ recordId: id }, "Semester record not found");
    throw new NotFoundError("Semester record not found");
  }
  logger.debug({ recordId: id }, "Semester record retrieved successfully");
  return item;
}

/**
 * Update semester record fields (academicYearId, semester).
 * @param id - SemesterRecord UUID
 * @param data - Partial update fields
 * @throws NotFoundError if record does not exist
 */
export async function update(id: string, data: { academicYearId?: string; semester?: number }) {
  logger.info({ recordId: id, data }, "Semester record service: updating record");
  // Ensure record exists before update
  await getById(id);
  const record = await prisma.semesterRecord.update({
    where: { id },
    data,
    include: {
      // Return full record with all relations after update
      student: { select: { id: true, name: true } },
      academicYear: { select: { year: true } },
      creator: { select: { id: true, name: true } },
      subjectScores: true,
      attendance: true,
      achievements: true,
      healthRecord: true,
      aiSummaries: true,
    },
  });
  logger.info({ recordId: id }, "Semester record updated successfully");
  return record;
}

/**
 * List all semester records for a given student, ordered by year then semester.
 * @param studentId - Student UUID
 */
export async function listByStudent(studentId: string) {
  logger.debug({ studentId }, "Semester record service: listing by student");
  const records = await prisma.semesterRecord.findMany({
    where: { studentId },
    include: {
      // Include academic year label and sub-resources for list display
      academicYear: { select: { year: true } },
      subjectScores: true,
      attendance: true,
      achievements: true,
      healthRecord: true,
    },
    // Sort chronologically: by year ascending, then semester (1 before 2)
    orderBy: [{ academicYear: { year: "asc" } }, { semester: "asc" }],
  });
  logger.info({ studentId, count: records.length }, "Semester records listed by student");
  return records;
}

/**
 * Delete a semester record and all related data in a single transaction.
 * @param id - SemesterRecord UUID
 * @throws NotFoundError if record does not exist
 */
export async function deleteRecord(id: string) {
  logger.info({ recordId: id }, "Semester record service: deleting record");
  // Ensure record exists before attempting deletion
  await getById(id);

  // Cascade delete all related data in a Prisma transaction
  await prisma.$transaction([
    prisma.subjectScore.deleteMany({ where: { semesterRecordId: id } }),
    prisma.attendance.deleteMany({ where: { semesterRecordId: id } }),
    prisma.achievement.deleteMany({ where: { semesterRecordId: id } }),
    prisma.healthRecord.deleteMany({ where: { semesterRecordId: id } }),
    prisma.aiSummary.deleteMany({ where: { semesterRecordId: id } }),
    // Delete the main record last (after all children are removed)
    prisma.semesterRecord.delete({ where: { id } }),
  ]);
  logger.info({ recordId: id }, "Semester record and related data deleted successfully");
}
