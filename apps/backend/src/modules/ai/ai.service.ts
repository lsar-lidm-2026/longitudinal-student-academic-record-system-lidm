/**
 * AI Service
 * ==========
 * Cara Kerja:
 *   1. Menyediakan 3 fungsi utama: generateStudentSummary, generateDraftDescription,
 *      generateTransitionSummary — masing-masing dipanggil dari controller.
 *   2. Setiap fungsi mengambil data akademik siswa via `getStudentAcademicData`,
 *      membangun prompt, lalu memanggil LLM (OpenAI-compatible API).
 *   3. Jika LLM gagal, fallback ke fungsi `generateMock*` lokal agar aplikasi tetap jalan.
 *   4. Hasil AI disimpan ke tabel AiSummary via Prisma transaction dengan
 *      atomic version increment (race condition safe).
 *   5. Transition summary menggunakan concurrent batching (concurrency limit)
 *      untuk menghindari overload API LLM.
 *
 * Alur Lengkap:
 *   Controller → {generateStudentSummary|generateDraftDescription|generateTransitionSummary}
 *     → getStudentAcademicData (fetch student + semesterRecords + relasi)
 *     → build prompt → generateChatCompletion (LLM call / fallback lokal)
 *     → prisma.$transaction (aggregate max version → create AiSummary + 1)
 *     → return AiSummary record
 *
 * Fallback Lokal:
 *   - generateMockStudentSummary       → narasi perkembangan (3 paragraf)
 *   - generateMockDraftDescription     → deskripsi per mapel
 *   - generateMockTransitionSummary    → catatan serah terima
 */

import { prisma } from "../../lib/prisma";
import { NotFoundError } from "../../common/error";
import { generateChatCompletion } from "./llm.client";
import {
  buildStudentSummaryPrompt,
  buildDraftDescriptionPrompt,
  buildTransitionSummaryPrompt,
} from "./prompts";
import type { SummaryType } from "../../generated/prisma/client";
import logger from "../../lib/logger";

/**
 * Fetch student + class + all semester records with related data.
 * Used by all three generation functions.
 * @param studentId — UUID of the student
 * @returns { student, semesterRecords } — Student object and ordered array of SemesterRecord
 */
async function getStudentAcademicData(studentId: string) {
  logger.debug({ studentId }, "getStudentAcademicData — fetching student data");

  // Fetch student dengan relasi class (untuk nama kelas + homeroomTeacherId)
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { class: true },
  });
  if (!student) {
    logger.error({ studentId }, "getStudentAcademicData — student not found");
    throw new NotFoundError("Student not found");
  }

  // Ambil semua semester records milik siswa, urut ascending by year & semester
  const semesterRecords = await prisma.semesterRecord.findMany({
    where: { studentId },
    include: {
      academicYear: true,
      subjectScores: true,
      attendance: true,
      achievements: true,
    },
    orderBy: [{ academicYear: { year: "asc" } }, { semester: "asc" }],
  });
 
  // Ambil catatan guru terbaru sebagai konteks AI (FR-11: catatan guru sebagai input AI)
  const latestNote = await prisma.teacherNote.findFirst({
    where: { studentId },
    orderBy: { createdAt: "desc" },
    select: { content: true },
  });
 
  logger.debug({ studentId, semesterCount: semesterRecords.length }, "getStudentAcademicData — semester records fetched");
  return { student, semesterRecords, latestTeacherNote: latestNote?.content || null };
}

// ── Local fallback generators (digunakan jika LLM unreachable / error) ─────────

/**
 * Generate fallback narasi perkembangan siswa (3 paragraf) berdasarkan nilai rata-rata
 * dan data kehadiran. Dipanggil ketika LLM API gagal.
 * @param data — Object berisi subjectScores, attendance, achievements, name
 * @returns string — Narasi fallback berbahasa Indonesia
 */
function generateMockStudentSummary(data: any): string {
  // Hitung rata-rata nilai pengetahuan
  const avg = Math.round(
    data.subjectScores.reduce((sum: number, s: any) => sum + s.knowledgeScore, 0) /
      data.subjectScores.length
  );
  // Total absensi (sakit + izin + alpha)
  const attendance = data.attendance;
  const abs = attendance ? attendance.sick + attendance.permission + attendance.absent : 0;

  // Paragraf 1: Penilaian umum berdasarkan rata-rata nilai
  let p1 = `${data.name} menunjukkan perkembangan akademik yang `;
  if (avg >= 85) {
    p1 += "sangat baik sepanjang semester ini. Ia aktif berpartisipasi di kelas dan menguasai hampir seluruh materi pelajaran dengan sangat memuaskan.";
  } else if (avg >= 75) {
    p1 += "cukup baik dan stabil. Sebagian besar standar kompetensi minimal telah tercapai dengan baik, meskipun masih ada ruang untuk peningkatan.";
  } else {
    p1 += "memerlukan perhatian dan bimbingan tambahan. Beberapa nilai mata pelajaran masih berada di bawah KKM, sehingga diperlukan perhatian ekstra di semester berikutnya.";
  }

  // Paragraf 2: Nilai rata-rata + prestasi (jika ada)
  let p2 = ` Rata-rata nilai pengetahuan semester ini adalah ${avg}.`;
  if (data.achievements && data.achievements.length > 0) {
    p2 += ` Selain itu, siswa juga menorehkan prestasi dalam bidang "${data.achievements[0].title}" (${data.achievements[0].type}).`;
  }

  // Paragraf 3: Catatan kehadiran
  let p3 = "";
  if (abs > 5) {
    p3 = ` Catatan khusus: Kehadiran siswa perlu diperbaiki karena tercatat absen sebanyak ${abs} hari, yang sedikit mempengaruhi konsistensi belajarnya.`;
  } else {
    p3 = " Kedisiplinan dan kehadiran siswa sangat baik, dukung terus motivasi belajarnya di rumah.";
  }

  return p1 + p2 + p3 + "\n\n*(Catatan: Narasi dihasilkan oleh asisten analisis lokal LSAR)*";
}

/**
 * Generate fallback draft deskripsi rapor per mata pelajaran.
 * Dipanggil ketika LLM API gagal.
 * @param data — Object berisi name, semester, academicYear, subjectScores
 * @returns string — Draft deskripsi per mapel berbahasa Indonesia
 */
function generateMockDraftDescription(data: any): string {
  // Baris intro dengan nama, semester, dan tahun ajaran
  const intro = `Rekomendasi kompetensi hasil belajar untuk ${data.name} (Semester ${data.semester}, TA ${data.academicYear}):\n\n`;
  // Buat bullet list deskripsi per mapel berdasarkan rentang nilai
  const items = data.subjectScores.map((s: any) => {
    let desc = "";
    if (s.knowledgeScore >= 88) {
      desc = `Sangat menonjol dalam menguasai seluruh materi dan kompetensi dasar ${s.subjectName}.`;
    } else if (s.knowledgeScore >= 75) {
      desc = `Menunjukkan pemahaman yang baik dan mampu menyelesaikan tugas-tugas ${s.subjectName} dengan teratur.`;
    } else {
      desc = `Perlu bimbingan intensif dan latihan berkala untuk memahami materi dasar ${s.subjectName}.`;
    }
    return `- **${s.subjectName}**: ${desc}`;
  }).join("\n");

  return intro + items + "\n\n*(Catatan: Rekomendasi kompetensi dihasilkan oleh asisten analisis lokal LSAR)*";
}

/**
 * Generate fallback catatan serah terima wali kelas.
 * Dipanggil ketika LLM API gagal.
 * @param allData — Array data akademik seluruh semester
 * @returns string — Catatan transisi berbahasa Indonesia
 */
function generateMockTransitionSummary(allData: any[]): string {
  // Jika tidak ada data sama sekali
  if (allData.length === 0) return "Tidak ada data riwayat akademik untuk evaluasi serah terima.";
  // Ambil nama siswa dari record pertama
  const name = allData[0].name;
  // Ambil semester terakhir untuk rata-rata nilai
  const lastSem = allData[allData.length - 1];
  const avg = Math.round(
    lastSem.subjectScores.reduce((sum: number, s: any) => sum + s.knowledgeScore, 0) /
      lastSem.subjectScores.length
  );

  return `Catatan Serah Terima (Wali Kelas) untuk ${name}:\n\n` +
    `1. **Perkembangan Umum**: Siswa menyelesaikan jenjang kelas dengan rata-rata akhir ${avg}.\n` +
    `2. **Kekuatan Akademik**: Menunjukkan bakat dan minat yang stabil pada beberapa mata pelajaran utama.\n` +
    `3. **Rekomendasi untuk Wali Kelas Berikutnya**: Pertahankan motivasi belajar siswa dan berikan pendampingan berkelanjutan agar konsistensi belajarnya tetap terjaga.\n\n` +
    `*(Catatan: Rangkuman transisi dihasilkan oleh asisten analisis lokal LSAR)*`;
}

// ── Exported Service Methods ───────────────────────────────────────────────

/**
 * Generate AI-powered student summary (ringkasan perkembangan siswa).
 * - Mengambil data akademik semester terakhir
 * - Memanggil LLM, fallback ke generateMockStudentSummary jika gagal
 * - Menyimpan ke AiSummary dengan atomic version increment
 *
 * @param studentId — UUID siswa
 * @returns AiSummary record yang baru dibuat
 */
export async function generateStudentSummary(studentId: string) {
  logger.info({ studentId }, "generateStudentSummary — start");

  // Ambil data akademik lengkap siswa (termasuk catatan guru terbaru)
  const { student, semesterRecords, latestTeacherNote } = await getStudentAcademicData(studentId);
  // Hanya gunakan semester record terakhir (paling baru)
  const latest = semesterRecords[semesterRecords.length - 1];
  if (!latest) {
    logger.error({ studentId }, "generateStudentSummary — no semester records found");
    throw new NotFoundError("No semester records found");
  }

  // Bentuk objek data untuk prompt (FR-11: include catatan guru + notes per mapel)
  const data = {
    name: student.name,
    className: student.class.name,
    semester: latest.semester,
    academicYear: latest.academicYear.year,
    // Peta nilai per mapel — termasuk catatan individu jika ada
    subjectScores: latest.subjectScores.map((s) => ({
      subjectName: s.subjectName,
      knowledgeScore: s.knowledgeScore,
      skillsScore: s.skillsScore,
      notes: s.notes,
    })),
    attendance: latest.attendance
      ? { sick: latest.attendance.sick, permission: latest.attendance.permission, absent: latest.attendance.absent }
      : null,
    achievements: latest.achievements.map((a) => ({ title: a.title, type: a.type })),
    // Catatan guru terbaru sebagai konteks tambahan untuk LLM
    teacherNote: latestTeacherNote,
  };

  // Bangun prompt sesuai template student summary
  const prompt = buildStudentSummaryPrompt(data);
  let content: string;

  // Panggil LLM — fallback ke mock lokal jika gagal
  try {
    logger.debug({ studentId, studentName: student.name }, "generateStudentSummary — calling LLM");
    content = await generateChatCompletion([
      { role: "system", content: "Anda adalah asisten administrasi pendidikan SD." },
      { role: "user", content: prompt },
    ]);
    logger.info({ studentId }, "generateStudentSummary — LLM call succeeded");
  } catch (err) {
    logger.warn({ err, studentId, studentName: student.name }, "generateStudentSummary — LLM failed, using local fallback");
    content = generateMockStudentSummary(data);
  }

  // Atomic version increment — menggunakan Prisma transaction agar race-condition safe
  logger.debug({ studentId, semesterRecordId: latest.id }, "generateStudentSummary — saving to AiSummary with version increment");
  return prisma.$transaction(async (tx) => {
    // Cari version tertinggi yang sudah ada untuk semesterRecord + summaryType ini
    const max = await tx.aiSummary.aggregate({
      where: { semesterRecordId: latest.id, summaryType: "STUDENT_SUMMARY" },
      _max: { version: true },
    });
    // Increment version (atau mulai dari 1 jika belum ada)
    const nextVersion = (max._max.version || 0) + 1;

    return tx.aiSummary.create({
      data: {
        semesterRecordId: latest.id,
        summaryType: "STUDENT_SUMMARY",
        content,
        version: nextVersion,
        isFinal: false, // Human-in-the-loop: default false, guru akan set ke true
      },
    });
  });
}

/**
 * Generate AI-powered draft description (draft deskripsi rapor).
 * - Mengambil data akademik semester terakhir
 * - Memanggil LLM, fallback ke generateMockDraftDescription jika gagal
 * - Menyimpan ke AiSummary dengan atomic version increment
 *
 * @param studentId — UUID siswa
 * @returns AiSummary record yang baru dibuat
 */
export async function generateDraftDescription(studentId: string) {
  logger.info({ studentId }, "generateDraftDescription — start");

  // Ambil data akademik lengkap siswa (termasuk catatan guru terbaru)
  const { student, semesterRecords, latestTeacherNote } = await getStudentAcademicData(studentId);
  // Hanya gunakan semester record terakhir
  const latest = semesterRecords[semesterRecords.length - 1];
  if (!latest) {
    logger.error({ studentId }, "generateDraftDescription — no semester records found");
    throw new NotFoundError("No semester records found");
  }

  // Bentuk objek data untuk prompt (FR-12: include notes per mapel + catatan guru)
  const data = {
    name: student.name,
    className: student.class.name,
    semester: latest.semester,
    academicYear: latest.academicYear.year,
    subjectScores: latest.subjectScores.map((s) => ({
      subjectName: s.subjectName,
      knowledgeScore: s.knowledgeScore,
      skillsScore: s.skillsScore,
      notes: s.notes,
    })),
    attendance: latest.attendance
      ? { sick: latest.attendance.sick, permission: latest.attendance.permission, absent: latest.attendance.absent }
      : null,
    achievements: latest.achievements.map((a) => ({ title: a.title, type: a.type })),
    // Catatan guru sebagai konteks untuk deskripsi rapor yang lebih personal
    teacherNote: latestTeacherNote,
  };

  // Bangun prompt sesuai template draft description
  const prompt = buildDraftDescriptionPrompt(data);
  let content: string;

  // Panggil LLM — fallback ke mock lokal jika gagal
  try {
    logger.debug({ studentId, studentName: student.name }, "generateDraftDescription — calling LLM");
    content = await generateChatCompletion([
      { role: "system", content: "Anda adalah asisten guru SD." },
      { role: "user", content: prompt },
    ]);
    logger.info({ studentId }, "generateDraftDescription — LLM call succeeded");
  } catch (err) {
    logger.warn({ err, studentId, studentName: student.name }, "generateDraftDescription — LLM failed, using local fallback");
    content = generateMockDraftDescription(data);
  }

  // Atomic version increment
  logger.debug({ studentId, semesterRecordId: latest.id }, "generateDraftDescription — saving to AiSummary with version increment");
  return prisma.$transaction(async (tx) => {
    const max = await tx.aiSummary.aggregate({
      where: { semesterRecordId: latest.id, summaryType: "DRAFT_DESCRIPTION" },
      _max: { version: true },
    });
    const nextVersion = (max._max.version || 0) + 1;

    return tx.aiSummary.create({
      data: {
        semesterRecordId: latest.id,
        summaryType: "DRAFT_DESCRIPTION",
        content,
        version: nextVersion,
        isFinal: false,
      },
    });
  });
}

/**
 * Process one student's transition summary (used for concurrent batching).
 * Internal helper — tidak di-export langsung.
 * Mengambil seluruh semester records siswa, memanggil LLM, dan menyimpan hasil.
 *
 * @param studentId — UUID siswa
 * @returns AiSummary record atau null jika tidak ada data semester
 */
async function generateSingleTransitionSummary(studentId: string) {
  logger.debug({ studentId }, "generateSingleTransitionSummary — start");

  // Ambil data akademik lengkap siswa (dengan catatan guru terbaru)
  const { student: s, semesterRecords, latestTeacherNote } = await getStudentAcademicData(studentId);
  if (semesterRecords.length === 0) {
    logger.warn({ studentId }, "generateSingleTransitionSummary — no semester records, skipping");
    return null;
  }

  // Bentuk array data seluruh semester untuk prompt transisi
  // FR-13: include class name per semester untuk grade history + teacher notes
  const allData = semesterRecords.map((r) => ({
    name: s.name,
    // Gunakan nama kelas terkini — idealnya setiap semesterRecord punya classId sendiri
    className: s.class?.name || "",
    semester: r.semester,
    academicYear: r.academicYear.year,
    subjectScores: r.subjectScores.map((sc) => ({
      subjectName: sc.subjectName,
      knowledgeScore: sc.knowledgeScore,
      skillsScore: sc.skillsScore,
      notes: sc.notes,
    })),
    attendance: r.attendance
      ? { sick: r.attendance.sick, permission: r.attendance.permission, absent: r.attendance.absent }
      : null,
    achievements: r.achievements.map((a) => ({ title: a.title, type: a.type })),
    // Catatan guru terbaru sebagai konteks untuk wali kelas baru
    teacherNote: latestTeacherNote,
  }));

  // Bangun prompt transisi dengan data seluruh semester
  const prompt = buildTransitionSummaryPrompt(allData);
  let content: string;

  // Panggil LLM — fallback ke mock lokal jika gagal
  try {
    logger.debug({ studentId, studentName: s.name }, "generateSingleTransitionSummary — calling LLM");
    content = await generateChatCompletion([
      { role: "system", content: "Anda adalah asisten serah terima wali kelas SD." },
      { role: "user", content: prompt },
    ]);
    logger.info({ studentId }, "generateSingleTransitionSummary — LLM call succeeded");
  } catch (err) {
    logger.warn({ err, studentId, studentName: s.name }, "generateSingleTransitionSummary — LLM failed, using local fallback");
    content = generateMockTransitionSummary(allData);
  }

  // Gunakan semester record terakhir sebagai anchor untuk AiSummary
  const latestRecord = semesterRecords[semesterRecords.length - 1];

  // Atomic version increment
  logger.debug({ studentId, semesterRecordId: latestRecord.id }, "generateSingleTransitionSummary — saving to AiSummary");
  return prisma.$transaction(async (tx) => {
    const max = await tx.aiSummary.aggregate({
      where: { semesterRecordId: latestRecord.id, summaryType: "TRANSITION_SUMMARY" },
      _max: { version: true },
    });
    const nextVersion = (max._max.version || 0) + 1;

    return tx.aiSummary.create({
      data: {
        semesterRecordId: latestRecord.id,
        summaryType: "TRANSITION_SUMMARY",
        content,
        version: nextVersion,
        isFinal: false,
      },
    });
  });
}

/**
 * Generate transition summaries for ALL students in a class.
 * Mengambil daftar siswa dalam classId, lalu memproses secara concurrent
 * dengan concurrency limit agar tidak membanjiri API LLM.
 *
 * @param classId — UUID kelas
 * @param concurrency — Jumlah siswa yang diproses paralel (default: 3)
 * @returns Array AiSummary records
 */
export async function generateTransitionSummary(classId: string, concurrency = 3) {
  logger.info({ classId, concurrency }, "generateTransitionSummary — start");

  // Ambil semua student ID dalam kelas
  const students = await prisma.student.findMany({
    where: { classId },
    select: { id: true },
  });

  logger.debug({ classId, studentCount: students.length }, "generateTransitionSummary — students fetched");

  // Array penampung hasil
  const results: Awaited<ReturnType<typeof generateSingleTransitionSummary>>[] = [];

  // Proses dalam batch concurrent (default 3 siswa per batch)
  for (let i = 0; i < students.length; i += concurrency) {
    // Ambil satu batch siswa
    const batch = students.slice(i, i + concurrency);
    logger.debug({ classId, batchStart: i, batchSize: batch.length }, "generateTransitionSummary — processing batch");

    // Jalankan semua Promise dalam batch secara parallel
    const batchResults = await Promise.allSettled(
      batch.map((s) => generateSingleTransitionSummary(s.id))
    );

    // Kumpulkan hasil: hanya yang fulfilled dan tidak null
    for (const r of batchResults) {
      if (r.status === "fulfilled" && r.value !== null) {
        results.push(r.value);
      } else if (r.status === "rejected") {
        // Log error per-student tanpa menggagalkan batch
        logger.warn({ err: r.reason, classId }, "Transition summary failed for a student in batch");
      }
    }
  }

  logger.info({ classId, totalResults: results.length }, "generateTransitionSummary — complete");
  return results;
}
