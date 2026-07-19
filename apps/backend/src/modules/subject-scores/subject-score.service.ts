/**
 * SUBJECT SCORE SERVICE
 * =====================
 *
 * Cara kerja file ini:
 * Service layer untuk resource SubjectScore. Mengelola operasi upsert
 * (create/update berdasarkan composite unique [semesterRecordId, subjectName]),
 * update by ID, delete, dan batch upsert dalam Prisma transaction.
 *
 * Alur lengkap per fungsi:
 *
 * 1. upsert(semesterRecordId, data)
 *    - Validasi semesterRecordId: pastikan SemesterRecord exists
 *    - Prisma.subjectScore.upsert dengan composite where
 *      [semesterRecordId + subjectName]:
 *      - Jika sudah ada → update knowledgeScore, skillsScore, notes
 *      - Jika belum ada → create baru
 *    - Return subject score yang di-create/di-update
 *
 * 2. update(id, data)
 *    - findUnique by ID untuk memastikan record exists
 *    - Throw NotFoundError jika tidak ditemukan
 *    - Prisma.subjectScore.update dengan partial data
 *    - Return subject score yang diupdate
 *
 * 3. remove(id)
 *    - findUnique by ID untuk memastikan record exists
 *    - Throw NotFoundError jika tidak ditemukan
 *    - Prisma.subjectScore.delete
 *    - Return subject score yang dihapus
 *
 * 4. batchUpsert(semesterRecordId, scores[])
 *    - Validasi semesterRecordId: pastikan SemesterRecord exists
 *    - Prisma.$transaction dengan array upsert operations
 *    - Setiap score di-upsert berdasarkan composite key yang sama
 *    - Return array subject scores yang di-create/di-update
 */

import { prisma } from "../../lib/prisma";
import { NotFoundError } from "../../common/error";
import { Prisma } from "../../generated/prisma/client";
import logger from "../../lib/logger";

/**
 * Upsert a subject score: create if not exists, update if exists.
 * Uses composite unique constraint [semesterRecordId + subjectName].
 * @param semesterRecordId - Parent semester record UUID
 * @param data - Score data (subjectName, knowledgeScore, skillsScore, optional notes)
 * @throws NotFoundError if semester record does not exist
 */
export async function upsert(
  semesterRecordId: string,
  data: {
    subjectName: string;
    knowledgeScore: number;
    skillsScore: number;
    notes?: string;
  }
) {
  logger.debug({ semesterRecordId, subjectName: data.subjectName }, "Subject score service: upsert");

  // Verify parent semester record exists before upserting
  const record = await prisma.semesterRecord.findUnique({
    where: { id: semesterRecordId },
  });
  if (!record) {
    logger.warn({ semesterRecordId }, "Semester record not found for subject score upsert");
    throw new NotFoundError("Semester record not found");
  }

  const score = await prisma.subjectScore.upsert({
    where: {
      // Composite unique key: one score per subject per semester record
      semesterRecordId_subjectName: {
        semesterRecordId,
        subjectName: data.subjectName,
      },
    },
    update: {
      // Update existing record with new scores
      knowledgeScore: data.knowledgeScore,
      skillsScore: data.skillsScore,
      notes: data.notes || null,
    },
    create: {
      // Create new record if composite key not found
      semesterRecordId,
      subjectName: data.subjectName,
      knowledgeScore: data.knowledgeScore,
      skillsScore: data.skillsScore,
      notes: data.notes || null,
    },
  });
  logger.info({ scoreId: score.id, subjectName: data.subjectName, semesterRecordId }, "Subject score upserted");
  return score;
}

/**
 * Update a subject score by its ID.
 * @param id - SubjectScore UUID
 * @param data - Partial fields to update
 * @throws NotFoundError if subject score does not exist
 */
export async function update(
  id: string,
  data: {
    subjectName?: string;
    knowledgeScore?: number;
    skillsScore?: number;
    notes?: string;
  }
) {
  logger.debug({ scoreId: id, data }, "Subject score service: update");

  // Verify subject score exists before update
  const item = await prisma.subjectScore.findUnique({ where: { id } });
  if (!item) {
    logger.warn({ scoreId: id }, "Subject score not found for update");
    throw new NotFoundError("Subject score not found");
  }

  const updated = await prisma.subjectScore.update({ where: { id }, data });
  logger.info({ scoreId: id }, "Subject score updated");
  return updated;
}

/**
 * Delete a subject score by its ID.
 * @param id - SubjectScore UUID
 * @throws NotFoundError if subject score does not exist
 */
export async function remove(id: string) {
  logger.debug({ scoreId: id }, "Subject score service: remove");

  // Verify subject score exists before deletion
  const item = await prisma.subjectScore.findUnique({ where: { id } });
  if (!item) {
    logger.warn({ scoreId: id }, "Subject score not found for removal");
    throw new NotFoundError("Subject score not found");
  }

  const deleted = await prisma.subjectScore.delete({ where: { id } });
  logger.info({ scoreId: id }, "Subject score removed");
  return deleted;
}

/**
 * Batch upsert multiple subject scores in a single Prisma transaction.
 * Each score is upserted independently using the composite unique key.
 * @param semesterRecordId - Parent semester record UUID
 * @param scores - Array of score objects to upsert
 * @throws NotFoundError if semester record does not exist
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
  logger.info({ semesterRecordId, count: scores.length }, "Subject score service: batch upsert");

  // Verify parent semester record exists before batch operation
  const record = await prisma.semesterRecord.findUnique({
    where: { id: semesterRecordId },
  });
  if (!record) {
    logger.warn({ semesterRecordId }, "Semester record not found for batch upsert");
    throw new NotFoundError("Semester record not found");
  }

  // Execute all upserts in a single database transaction for atomicity
  const results = await prisma.$transaction(
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
  logger.info({ semesterRecordId, count: results.length }, "Subject scores batch upserted successfully");
  return results;
}
