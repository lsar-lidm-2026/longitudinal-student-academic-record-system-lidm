/**
 * Prompts / Template Builder
 * ===========================
 * Cara Kerja:
 *   1. Mendefinisikan interface `StudentData` sebagai kontrak data yang dibutuhkan
 *      untuk membangun prompt ke LLM.
 *   2. Tiga fungsi pure template builder:
 *      - `buildStudentSummaryPrompt`   → Prompt untuk ringkasan perkembangan siswa (3 paragraf)
 *      - `buildDraftDescriptionPrompt` → Prompt untuk draft deskripsi rapor per mapel
 *      - `buildTransitionSummaryPrompt` → Prompt untuk catatan serah terima antar wali kelas
 *   3. Setiap fungsi menerima data terstruktur dan mengembalikan string prompt
 *      dalam Bahasa Indonesia yang siap dikirim ke LLM.
 *   4. Tidak ada side effect — semua fungsi murni (pure) transformasi data → string.
 *
 * Alur:
 *   ai.service / ai-summary.service → panggil build*Prompt(data) → dapat string prompt
 *   → kirim ke generateChatCompletion sebagai user message
 *
 * Prompt Design Notes:
 *   - Semua prompt menggunakan Bahasa Indonesia
 *   - Instruksi jelas tentang format output yang diharapkan
 *   - Data siswa disisipkan via template literal
 *   - Fallback nilai jika data kosong (misal: "Tidak ada data kehadiran", "Tidak ada prestasi")
 */

import logger from "../../lib/logger";

/**
 * Data terstruktur untuk membangun prompt.
 * Berisi informasi akademik dan non-akademik siswa yang relevan.
 */
interface StudentData {
  /** Nama lengkap siswa */
  name: string;
  /** Nama kelas (misal: "1A", "2B") */
  className: string;
  /** Semester (1 = Ganjil, 2 = Genap) */
  semester: number;
  /** Tahun ajaran (misal: "2025/2026") */
  academicYear: string;
  /** Array nilai per mata pelajaran */
  subjectScores: { subjectName: string; knowledgeScore: number; skillsScore: number }[];
  /** Data kehadiran (sakit, izin, alpha) — bisa null jika belum diisi */
  attendance: { sick: number; permission: number; absent: number } | null;
  /** Array prestasi siswa */
  achievements: { title: string; type: string }[];
}

/**
 * Build prompt untuk ringkasan perkembangan siswa (student summary).
 * Output: narasi 3 paragraf dalam Bahasa Indonesia.
 *
 * @param data — StudentData untuk satu semester
 * @returns string — Prompt siap kirim ke LLM
 */
export function buildStudentSummaryPrompt(data: StudentData): string {
  logger.debug({ studentName: data.name }, "buildStudentSummaryPrompt — building prompt");

  return `Anda adalah asisten administrasi pendidikan yang membantu guru SD.
Buat ringkasan perkembangan siswa berdasarkan data akademik berikut.
Ringkasan harus:
- Bahasa Indonesia yang baik dan benar
- Fokus pada kekuatan dan area pengembangan
- Objektif berdasarkan data
- Maksimal 3 paragraf

Data Siswa:
Nama: ${data.name}
Kelas: ${data.className}
Semester: ${data.semester === 1 ? "Ganjil" : "Genap"} - ${data.academicYear}

Nilai:
${data.subjectScores.map((s) => `- ${s.subjectName}: Pengetahuan ${s.knowledgeScore}, Keterampilan ${s.skillsScore}`).join("\n")}

Kehadiran:
${data.attendance ? `- Sakit: ${data.attendance.sick} hari\n- Izin: ${data.attendance.permission} hari\n- Alpha: ${data.attendance.absent} hari` : "Tidak ada data kehadiran"}

Prestasi:
${data.achievements.length > 0 ? data.achievements.map((a) => `- ${a.title} (${a.type})`).join("\n") : "Tidak ada prestasi"}`
;
}

/**
 * Build prompt untuk draft deskripsi rapor per mata pelajaran.
 * Output: bullet list dengan format **{Mapel}**: [deskripsi 2-3 kalimat].
 *
 * @param data — StudentData untuk satu semester
 * @returns string — Prompt siap kirim ke LLM
 */
export function buildDraftDescriptionPrompt(data: StudentData): string {
  logger.debug({ studentName: data.name }, "buildDraftDescriptionPrompt — building prompt");

  return `Anda adalah asisten guru SD yang membantu menyusun deskripsi rapor.
Buat draft deskripsi rapor untuk setiap mata pelajaran.
Deskripsi harus:
- Bahasa Indonesia yang baik
- Mencakup aspek pengetahuan dan keterampilan
- Memberikan gambaran objektif
- Disertai saran pengembangan yang konstruktif
- Tidak menggunakan kata-kata negatif

Data Siswa:
Nama: ${data.name}
Kelas: ${data.className}
Semester: ${data.semester === 1 ? "Ganjil" : "Genap"}

Nilai:
${data.subjectScores.map((s) => `- ${s.subjectName}: Pengetahuan ${s.knowledgeScore}, Keterampilan ${s.skillsScore}`).join("\n")}

Format Output:
**{Mata Pelajaran}**: [deskripsi narasi 2-3 kalimat]`;
}

/**
 * Build prompt untuk catatan serah terima antar wali kelas (transition summary).
 * Input: array StudentData untuk seluruh semester yang sudah ditempuh.
 * Output: 4 bagian (Profil Singkat, Kekuatan Akademik, Area Pengembangan, Catatan Penting).
 *
 * @param allSemesters — Array StudentData untuk seluruh riwayat semester siswa
 * @returns string — Prompt siap kirim ke LLM
 */
export function buildTransitionSummaryPrompt(allSemesters: StudentData[]): string {
  logger.debug({ semesterCount: allSemesters.length, studentName: allSemesters[0]?.name }, "buildTransitionSummaryPrompt — building prompt");

  // Format riwayat per semester menjadi teks terstruktur
  const semesterData = allSemesters.map(
    (s) => `Semester ${s.semester === 1 ? "Ganjil" : "Genap"} ${s.academicYear}:
Nilai: ${s.subjectScores.map((sc) => `${sc.subjectName}=${sc.knowledgeScore}/${sc.skillsScore}`).join(", ")}
Kehadiran: ${s.attendance ? `S:${s.attendance.sick} I:${s.attendance.permission} A:${s.attendance.absent}` : "N/A"}
Prestasi: ${s.achievements.map((a) => a.title).join(", ") || "Tidak ada"}`
  ).join("\n\n");

  return `Anda adalah asisten yang membantu serah terima wali kelas di SD.
Buat ringkasan transisi untuk wali kelas baru tentang siswa ini.
Ringkasan harus:
- Bahasa Indonesia yang baik
- Fokus pada informasi yang berguna untuk guru baru
- Mencakup kekuatan akademik, area pengembangan, dan catatan penting
- Maksimal 4 paragraf

Nama: ${allSemesters[0]?.name || "-"}
Riwayat Semester:
${semesterData}

Format Output:
1. Profil Singkat: [1 paragraf]
2. Kekuatan Akademik: [1-2 kalimat]
3. Area Pengembangan: [1-2 kalimat]
4. Catatan Penting untuk Wali Kelas Baru: [1-2 kalimat]`;
}
