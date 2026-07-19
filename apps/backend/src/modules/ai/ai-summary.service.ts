/**
 * AI Summary Service
 * ===================
 * Cara Kerja:
 *   1. Lapisan bisnis logic untuk CRUD AiSummary.
 *   2. `getBySemesterRecord` — Mengambil semua AiSummary milik suatu SemesterRecord,
 *      diurutkan berdasarkan version descending (terbaru di atas).
 *   3. `update` — Mengubah isFinal (human-in-the-loop approval) dan/atau content.
 *      Hanya field yang dikirim yang diupdate (partial update).
 *   4. `remove` — Hapus AiSummary by ID. Throw NotFoundError jika tidak ditemukan.
 *   5. `regenerate` — Regenerasi konten via LLM. Mengambil data dari SemesterRecord yang sudah ada,
 *      memanggil LLM sesuai summaryType (DRAFT_DESCRIPTION / STUDENT_SUMMARY),
 *      lalu menyimpan sebagai AiSummary baru dengan version = max(version) + 1.
 *      TRANSITION_SUMMARY tidak di-regen (tidak ada prompt untuk itu di sini).
 *   6. Semua penyimpanan menggunakan Prisma transaction agar atomic version increment
 *      aman dari race condition.
 *
 * Alur Lengkap (regenerate):
 *   Controller → regenerate(id)
 *     → fetch AiSummary + SemesterRecord + relasi (student, subjectScores, attendance, achievements)
 *     → pilih prompt & system message berdasarkan summaryType
 *     → generateChatCompletion (LLM) → error → throw AiError
 *     → prisma.$transaction (aggregate max version → create AiSummary baru)
 *     → return AiSummary record baru
 */

import { prisma } from "../../lib/prisma";
import { NotFoundError, AiError } from "../../common/error";
import { generateChatCompletion } from "./llm.client";
import { buildStudentSummaryPrompt, buildDraftDescriptionPrompt } from "./prompts";
import logger from "../../lib/logger";

/**
 * Get all AiSummary records for a given SemesterRecord.
 * Diurutkan version descending (terbaru di atas).
 *
 * @param semesterRecordId — UUID SemesterRecord
 * @returns Array of AiSummary
 */
export async function getBySemesterRecord(semesterRecordId: string) {
  logger.debug({ semesterRecordId }, "getBySemesterRecord — fetching AI summaries");

  const summaries = await prisma.aiSummary.findMany({
    where: { semesterRecordId },
    orderBy: [{ version: "desc" }],
  });

  logger.debug({ semesterRecordId, count: summaries.length }, "getBySemesterRecord — fetched");
  return summaries;
}

/**
 * Update isFinal (human-in-the-loop approval) dan/atau content AiSummary.
 * Partial update — hanya field yang dikirim yang diubah.
 *
 * @param id — UUID AiSummary
 * @param data — { isFinal?: boolean, content?: string }
 * @returns AiSummary yang sudah diupdate
 * @throws NotFoundError jika AiSummary tidak ditemukan
 */
export async function update(id: string, data: { isFinal?: boolean; content?: string }) {
  logger.info({ summaryId: id, data }, "update — updating AI summary");

  // Cek keberadaan AiSummary
  const existing = await prisma.aiSummary.findUnique({ where: { id } });
  if (!existing) {
    logger.error({ summaryId: id }, "update — AI summary not found");
    throw new NotFoundError("AI Summary not found");
  }

  logger.debug({ summaryId: id, isFinal: data.isFinal, contentChanged: data.content !== undefined }, "update — applying update");

  // Partial update: hanya set field yang dikirim
  return prisma.aiSummary.update({
    where: { id },
    data: {
      ...(data.isFinal !== undefined ? { isFinal: data.isFinal } : {}),
      ...(data.content !== undefined ? { content: data.content } : {}),
    },
  });
}

/**
 * Delete an AiSummary record.
 *
 * @param id — UUID AiSummary
 * @returns AiSummary yang dihapus
 * @throws NotFoundError jika tidak ditemukan
 */
export async function remove(id: string) {
  logger.info({ summaryId: id }, "remove — deleting AI summary");

  // Cek keberadaan AiSummary sebelum delete
  const existing = await prisma.aiSummary.findUnique({ where: { id } });
  if (!existing) {
    logger.error({ summaryId: id }, "remove — AI summary not found");
    throw new NotFoundError("AI Summary not found");
  }

  const deleted = await prisma.aiSummary.delete({ where: { id } });
  logger.info({ summaryId: id }, "remove — deleted successfully");
  return deleted;
}

/**
 * Regenerate konten AiSummary via LLM.
 * - Mengambil data SemesterRecord yang sudah ada
 * - Memilih prompt & system message sesuai summaryType
 * - Memanggil LLM (tanpa fallback lokal — error langsung throw AiError)
 * - Menyimpan hasil sebagai AiSummary baru dengan version increment
 *
 * @param id — UUID AiSummary (lama, yang akan di-regen)
 * @returns AiSummary record baru (version lama + 1)
 * @throws NotFoundError jika AiSummary tidak ditemukan
 * @throws AiError jika LLM call gagal
 */
export async function regenerate(id: string) {
  logger.info({ summaryId: id }, "regenerate — starting AI summary regeneration");

  // Fetch AiSummary yang ada beserta data semester record
  const existing = await prisma.aiSummary.findUnique({
    where: { id },
    include: {
      semesterRecord: {
        include: {
          student: { select: { id: true, name: true } },
          subjectScores: true,
          attendance: true,
          achievements: true,
        },
      },
    },
  });
  if (!existing) {
    logger.error({ summaryId: id }, "regenerate — AI summary not found");
    throw new NotFoundError("AI Summary not found");
  }

  // Data semester record untuk dibangun prompt
  const record = existing.semesterRecord;
  const data = {
    name: record.student.name,
    className: "",
    semester: record.semester,
    academicYear: "",
    subjectScores: record.subjectScores.map((s) => ({
      subjectName: s.subjectName,
      knowledgeScore: s.knowledgeScore,
      skillsScore: s.skillsScore,
    })),
    attendance: record.attendance
      ? { sick: record.attendance.sick, permission: record.attendance.permission, absent: record.attendance.absent }
      : null,
    achievements: record.achievements.map((a) => ({ title: a.title, type: a.type })),
  };

  // Pilih prompt berdasarkan tipe summary (hanya STUDENT_SUMMARY atau DRAFT_DESCRIPTION)
  const prompt =
    existing.summaryType === "DRAFT_DESCRIPTION"
      ? buildDraftDescriptionPrompt(data)
      : buildStudentSummaryPrompt(data);

  // Pilih system message sesuai tipe
  const systemMessage =
    existing.summaryType === "DRAFT_DESCRIPTION"
      ? "Anda adalah asisten guru SD. Buatkan draft deskripsi rapor."
      : "Anda adalah asisten administrasi pendidikan SD.";

  logger.debug({ summaryId: id, summaryType: existing.summaryType, studentName: record.student.name }, "regenerate — calling LLM");

  // Panggil LLM — jika gagal, throw AiError (tidak ada fallback lokal di sini)
  const content = await generateChatCompletion([
    { role: "system", content: systemMessage },
    { role: "user", content: prompt },
  ]).catch(() => {
    logger.error({ summaryId: id, summaryType: existing.summaryType }, "regenerate — LLM call failed");
    throw new AiError("Gagal menghubungi layanan AI");
  });

  logger.debug({ summaryId: id }, "regenerate — LLM call succeeded, saving with version increment");

  // Atomic version increment via transaction
  return prisma.$transaction(async (tx) => {
    // Cari version tertinggi untuk semesterRecord + summaryType yang sama
    const max = await tx.aiSummary.aggregate({
      where: { semesterRecordId: record.id, summaryType: existing.summaryType },
      _max: { version: true },
    });
    const nextVersion = (max._max.version || 0) + 1;

    return tx.aiSummary.create({
      data: {
        semesterRecordId: record.id,
        summaryType: existing.summaryType,
        content,
        version: nextVersion,
        isFinal: false, // Setiap regenerasi reset isFinal ke false
      },
    });
  });
}
