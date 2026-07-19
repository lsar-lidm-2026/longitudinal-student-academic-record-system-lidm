/**
 * StudentTimeline — Komponen timeline vertikal riwayat semester siswa.
 * ====================================================================
 *
 * Cara Kerja:
 * 1. Menerima props `semesterRecords` — array SemesterRecord yang diurutkan dari awal.
 * 2. Setiap record ditampilkan sebagai kartu dengan dot indikator dan garis penghubung vertikal.
 * 3. Untuk setiap semester, dihitung rata-rata nilai pengetahuan, rata-rata keterampilan,
 *    dan total absensi.
 * 4. Kartu menampilkan: tahun akademik, semester, ringkasan nilai (P/K/A), dan daftar
 *    beberapa mata pelajaran pertama.
 * 5. Jika mapel > 4, ditampilkan indikator "+N mapel lainnya".
 * 6. Jika tidak ada data semester, tampilkan pesan "Belum ada data semester".
 *
 * Alur:
 * - Parent mengambil data semesterRecords dari API (biasanya dari endpoint student detail).
 * - StudentTimeline merender timeline vertikal.
 * - Setiap kartu mewakili satu semester dengan detail nilai dan absensi.
 * - Warna dan ikon menunjukkan progres semester (biru untuk semester aktif).
 *
 * @module StudentTimeline
 */

"use client";

import { SemesterRecord } from "@/types";
import { logger } from "@/lib/logger";

/** Props yang diterima komponen StudentTimeline */
interface StudentTimelineProps {
  /** Array data semester siswa — diurutkan kronologis */
  semesterRecords: SemesterRecord[];
}

/**
 * StudentTimeline — timeline vertikal riwayat semester siswa.
 * @param {StudentTimelineProps} props - array semesterRecords
 */
export function StudentTimeline({ semesterRecords }: StudentTimelineProps) {
  // Log jumlah data semester yang diterima
  logger.info("StudentTimeline", "Render timeline", {
    totalSemester: semesterRecords.length,
  });

  // Jika tidak ada data semester, tampilkan empty state
  if (semesterRecords.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Belum ada data semester
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {semesterRecords.map((record, idx) => {
        /**
         * Hitung rata-rata nilai pengetahuan dari semua SubjectScore di semester ini.
         * Jika tidak ada SubjectScore, hasilnya 0.
         */
        const avgKnowledge =
          record.subjectScores.length > 0
            ? Math.round(
                record.subjectScores.reduce(
                  (sum, s) => sum + s.knowledgeScore,
                  0
                ) / record.subjectScores.length
              )
            : 0;

        /**
         * Hitung rata-rata nilai keterampilan dari semua SubjectScore di semester ini.
         * Jika tidak ada SubjectScore, hasilnya 0.
         */
        const avgSkills =
          record.subjectScores.length > 0
            ? Math.round(
                record.subjectScores.reduce(
                  (sum, s) => sum + s.skillsScore,
                  0
                ) / record.subjectScores.length
              )
            : 0;

        /**
         * Hitung total absensi: Sakit + Izin + Alpha.
         * Attendance bersifat optional — fallback ke 0 jika null.
         */
        const totalAbsence =
          (record.attendance?.sick || 0) +
          (record.attendance?.permission || 0) +
          (record.attendance?.absent || 0);

        // Log data semester yang dirender
        logger.debug("StudentTimeline", "Render semester", {
          id: record.id,
          year: record.academicYear?.year,
          semester: record.semester,
          avgKnowledge,
          avgSkills,
          totalAbsence,
          subjectCount: record.subjectScores.length,
        });

        return (
          <div key={record.id} className="relative pl-8">
            {/* Garis penghubung vertikal antar dot — gradient biru */}
            {idx < semesterRecords.length - 1 && (
              <div className="absolute left-[11px] top-4 bottom-0 w-0.5 bg-gradient-to-b from-blue-200 to-blue-100" />
            )}

            {/* Dot indikator semester — lingkaran biru dengan dot putih */}
            <div className="absolute left-0 top-1.5 w-6 h-6 rounded-full bg-blue-500 border-2 border-white shadow-sm flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-white" />
            </div>

            {/* Kartu konten semester */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-4">
              {/* Header: tahun akademik + semester + badge nilai */}
              <div className="flex items-center justify-between mb-3">
                {/* Label tahun & semester */}
                <div className="flex items-center gap-3">
                  <span className="bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider border border-blue-100">
                    {record.academicYear?.year || "TA"}
                  </span>
                  <span className="text-sm font-semibold text-gray-900">
                    Semester {record.semester === 1 ? "Ganjil" : "Genap"}
                  </span>
                </div>

                {/* Badge ringkasan: P (Pengetahuan), K (Keterampilan), A (Absensi) */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">
                    P: {avgKnowledge}
                  </span>
                  <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                    K: {avgSkills}
                  </span>
                  <span className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                    A: {totalAbsence}
                  </span>
                </div>
              </div>

              {/* Separator */}
              <div className="h-px bg-gray-100 w-full mb-3" />

              {/* Grid daftar mapel — maksimal 4 mapel ditampilkan */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {record.subjectScores.slice(0, 4).map((sc) => (
                  <div
                    key={sc.id}
                    className="flex justify-between px-2 py-1 bg-gray-50/80 rounded-md text-xs"
                  >
                    {/* Nama mapel — truncated */}
                    <span className="text-gray-600 truncate mr-2">
                      {sc.subjectName}
                    </span>
                    {/* Nilai: Pengetahuan / Keterampilan */}
                    <span className="font-semibold text-blue-700 whitespace-nowrap">
                      {sc.knowledgeScore}/{sc.skillsScore}
                    </span>
                  </div>
                ))}

                {/* Indikator sisa mapel — hanya jika total mapel > 4 */}
                {record.subjectScores.length > 4 && (
                  <div className="flex items-center justify-center text-xs text-muted-foreground col-span-full mt-2">
                    +{record.subjectScores.length - 4} mata pelajaran lainnya
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
