/**
 * ScoreInput — Komponen input untuk memasukkan nilai Pengetahuan (P) dan Keterampilan (K)
 *              per mata pelajaran dalam satu semester.
 * ======================================================================================
 *
 * Cara Kerja:
 * 1. Menerima props `scores` (array ScoreInputData) dan `onChange` callback.
 * 2. Menampilkan daftar mata pelajaran dari konstanta SUBJECTS (8 mapel).
 * 3. Setiap baris mapel memiliki dua input: Nilai Pengetahuan dan Nilai Keterampilan.
 * 4. Perubahan nilai diproses oleh fungsi `updateScore` yang mencari index mapel,
 *    membuat salinan array, memperbarui field tertentu, lalu memanggil onChange.
 *
 * Alur:
 * - Parent menyediakan array scores dan onChange handler.
 * - User mengubah nilai di input → `updateScore(idx, field, value)` → salin array,
 *   perbarui field → `onChange(newScores)`.
 * - Jika mapel belum ada di array scores, input tetap ditampilkan dengan nilai default 0.
 *
 * @module ScoreInput
 */

"use client";

import { logger } from "@/lib/logger";

/** Tipe data satu baris nilai: nama mapel + nilai pengetahuan & keterampilan */
export interface ScoreInputData {
  subjectName: string;
  knowledgeScore: number;
  skillsScore: number;
}

/** Props yang diterima komponen ScoreInput */
interface ScoreInputProps {
  /** Array nilai semua mapel */
  scores: ScoreInputData[];
  /** Callback saat nilai berubah — dipanggil dengan array scores terbaru */
  onChange: (scores: ScoreInputData[]) => void;
}

/** Daftar tetap mata pelajaran SD — 8 mapel sesuai kurikulum */
const SUBJECTS = [
  "Pendidikan Agama",
  "Pendidikan Pancasila",
  "Bahasa Indonesia",
  "Matematika",
  "IPA",
  "IPS",
  "Seni Budaya",
  "PJOK",
];

/**
 * ScoreInput — render input nilai Pengetahuan dan Keterampilan untuk semua mapel.
 * @param {ScoreInputProps} props - array scores + onChange handler
 */
export function ScoreInput({ scores, onChange }: ScoreInputProps) {
  /**
   * Memperbarui nilai pada index tertentu di array scores.
   * @param idx - index mapel di array scores
   * @param field - field yang diubah ("knowledgeScore" | "skillsScore")
   * @param value - nilai number baru
   */
  function updateScore(idx: number, field: "knowledgeScore" | "skillsScore", value: number): void {
    // Salin array scores untuk immutability
    const newScores = [...scores];
    // Perbarui field yang sesuai pada object di index idx
    newScores[idx] = { ...newScores[idx], [field]: value };

    logger.info("ScoreInput", `Nilai ${field} diperbarui`, {
      subject: newScores[idx].subjectName,
      [field]: value,
      index: idx,
    });

    onChange(newScores);
  }

  /**
   * Konversi string input ke number.
   * String kosong dianggap 0 (agar input dapat dikosongkan pengguna).
   * @param val - nilai string dari input
   * @returns nilai number
   */
  function toNumber(val: string): number {
    return val === "" ? 0 : Number(val);
  }

  return (
    <div className="space-y-2">
      {/* Loop setiap mapel untuk render baris input */}
      {SUBJECTS.map((subject, idx) => {
        // Cari data mapel yang sudah ada di array scores, fallback ke default 0
        const score = scores.find((s) => s.subjectName === subject) || {
          subjectName: subject,
          knowledgeScore: 0,
          skillsScore: 0,
        };
        // Index sebenarnya di array scores (bisa -1 jika belum ada)
        const scoreIdx = scores.findIndex((s) => s.subjectName === subject);

        return (
          <div
            key={subject}
            className="flex flex-col sm:flex-row sm:items-center gap-3 p-2 bg-gray-50/50 rounded-lg"
          >
            {/* Nama mata pelajaran */}
            <span className="sm:w-44 text-sm font-medium text-gray-700">{subject}</span>

            {/* Input nilai — Pengetahuan (P) dan Keterampilan (K) */}
            <div className="flex gap-3">
              {/* Input Nilai Pengetahuan */}
              <input
                type="number"
                min="0"
                max="100"
                value={score.knowledgeScore || ""}
                onChange={(e) =>
                  updateScore(
                    scoreIdx >= 0 ? scoreIdx : idx, // Jika mapel belum ada, pakai index loop
                    "knowledgeScore",
                    toNumber(e.target.value)
                  )
                }
                placeholder="P"
                title="Nilai Pengetahuan"
                className="w-16 h-8 px-2 border border-gray-200 rounded-md text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-center"
              />

              {/* Input Nilai Keterampilan */}
              <input
                type="number"
                min="0"
                max="100"
                value={score.skillsScore || ""}
                onChange={(e) =>
                  updateScore(
                    scoreIdx >= 0 ? scoreIdx : idx,
                    "skillsScore",
                    toNumber(e.target.value)
                  )
                }
                placeholder="K"
                title="Nilai Keterampilan"
                className="w-16 h-8 px-2 border border-gray-200 rounded-md text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-center"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
