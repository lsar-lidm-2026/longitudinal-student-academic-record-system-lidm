/**
 * ValidationBadges — Komponen badge status kelengkapan data siswa per semester.
 * ==============================================================================
 *
 * Cara Kerja:
 * 1. Menerima props `validation` — array ValidationStatus yang berisi status kelengkapan
 *    untuk setiap semester (Nilai, Absensi, Kesehatan).
 * 2. Setiap item validation dirender sebagai baris yang menampilkan tahun/semester
 *    diikuti tiga badge status (Nilai, Hadir, Kesehatan).
 * 3. Komponen StatusBadge digunakan untuk render badge individual — hijau jika "complete",
 *    merah jika tidak.
 * 4. Jika array validation kosong, komponen mengembalikan null (tidak render apapun).
 *
 * Alur:
 * - Parent mengambil data validation status dari API.
 * - Parent merender ValidationBadges dengan array validation.
 * - Untuk setiap semester: tampilkan label tahun-semester + 3 StatusBadge.
 * - StatusBadge menerima boolean `isComplete` + label untuk menentukan warna.
 *
 * @module ValidationBadges
 */

"use client";

import { logger } from "@/lib/logger";

/** Status kelengkapan data untuk satu semester */
interface ValidationStatus {
  /** Tahun akademik (contoh: "2024/2025") */
  year: string;
  /** Nomor semester (1 = Ganjil, 2 = Genap) */
  semester: number;
  /** Object status kelengkapan per kategori */
  status: {
    /** Status nilai mapel — "complete" | "incomplete" */
    subjectScores: string;
    /** Status absensi — "complete" | "incomplete" */
    attendance: string;
    /** Status catatan kesehatan — "complete" | "incomplete" */
    healthRecord: string;
  };
}

/** Props yang diterima komponen ValidationBadges */
interface ValidationBadgesProps {
  /** Array status validasi per semester */
  validation: ValidationStatus[];
}

/**
 * StatusBadge — badge kecil hijau/merah yang menandakan status kelengkapan.
 * @param isComplete - true = hijau (lengkap), false = merah (belum lengkap)
 * @param label - teks badge (misal "Nilai", "Hadir", "Kesehatan")
 */
function StatusBadge({ isComplete, label }: { isComplete: boolean; label: string }) {
  if (isComplete) {
    // Badge hijau — data lengkap
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100">
        {label}
      </span>
    );
  }
  // Badge merah — data belum lengkap
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-50 text-red-600 border border-red-100">
      {label}
    </span>
  );
}

/**
 * ValidationBadges — menampilkan daftar status kelengkapan data per semester.
 * @param {ValidationBadgesProps} props - array validation status
 */
export function ValidationBadges({ validation }: ValidationBadgesProps) {
  // Jika tidak ada data validation, jangan render apapun
  if (validation.length === 0) {
    logger.info("ValidationBadges", "Tidak ada data validasi — komponen tidak dirender");
    return null;
  }

  logger.info("ValidationBadges", "Menampilkan validasi", {
    totalSemester: validation.length,
  });

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Status Kelengkapan</h3>
      <div className="space-y-2">
        {/* Loop setiap semester untuk render baris status */}
        {validation.map((v, idx) => (
          <div
            key={idx}
            className="flex items-center gap-3 text-sm p-3 bg-gray-50/50 rounded-lg border border-gray-100"
          >
            {/* Label tahun dan semester */}
            <span className="w-36 font-medium text-gray-700">
              {v.year} - Sem {v.semester}
            </span>

            {/* Badge Nilai — hijau jika complete */}
            <StatusBadge isComplete={v.status.subjectScores === "complete"} label="Nilai" />

            {/* Badge Absensi — hijau jika complete */}
            <StatusBadge isComplete={v.status.attendance === "complete"} label="Hadir" />

            {/* Badge Kesehatan — hijau jika complete */}
            <StatusBadge isComplete={v.status.healthRecord === "complete"} label="Kesehatan" />
          </div>
        ))}
      </div>
    </div>
  );
}
