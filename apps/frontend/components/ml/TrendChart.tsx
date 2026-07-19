/**
 * TrendChart — Komponen visualisasi tren akademik siswa.
 * =======================================================
 *
 * Cara Kerja:
 * 1. Menerima props `features` (object metrik akademik) dan `trend` (arah + deskripsi tren).
 * 2. Menampilkan banner tren (hijau = NAIK, merah = TURUN, kuning = STABIL).
 * 3. Menampilkan 4 kartu metrik: rata-rata pengetahuan, rata-rata keterampilan,
 *    delta semester, dan volatilitas skor.
 * 4. Menampilkan bar chart sederhana (4 bar) untuk perbandingan visual:
 *    pengetahuan, keterampilan, absensi, dan prestasi.
 * 5. Bar chart hanya muncul jika semesterCount > 0.
 *
 * Alur:
 * - Parent (misal halaman ML prediction) menyediakan features + trend dari API.
 * - TrendChart merender banner → metric cards → bar chart.
 * - Warna bar chart: biru (pengetahuan), hijau (keterampilan), oranye (absensi), ungu (prestasi).
 * - Tinggi bar dihitung dengan Math.min(value * scale, 100) untuk menjaga proporsi.
 *
 * @module TrendChart
 */

"use client";

import { logger } from "@/lib/logger";

/** Props yang diterima komponen TrendChart */
interface TrendChartProps {
  /** Metrik fitur akademik yang dianalisis */
  features: {
    /** Rata-rata nilai pengetahuan */
    avgKnowledge: number;
    /** Rata-rata nilai keterampilan */
    avgSkills: number;
    /** Selisih nilai antar semester (positif = naik, negatif = turun) */
    scoreDelta: number;
    /** Jumlah semester yang sudah ditempuh */
    semesterCount: number;
    /** Volatilitas skor — ukuran fluktuasi nilai */
    scoreVolatility: number;
    /** Total ketidakhadiran (sakit + izin + alpha) */
    totalAbsence: number;
    /** Jumlah prestasi yang diraih */
    achievementCount: number;
  };
  /** Data tren akademik */
  trend: {
    /** Arah tren: NAIK, STABIL, atau TURUN */
    trend: "NAIK" | "STABIL" | "TURUN";
    /** Deskripsi tren dalam bahasa natural */
    description: string;
  };
}

/**
 * TrendChart — menampilkan tren akademik siswa dalam bentuk banner, metrik, dan bar chart.
 * @param {TrendChartProps} props - features metrik + data tren
 */
export function TrendChart({ features, trend }: TrendChartProps) {
  /** Warna teks berdasarkan arah tren */
  const trendColor =
    trend.trend === "NAIK"
      ? "text-green-600"
      : trend.trend === "TURUN"
      ? "text-red-600"
      : "text-yellow-600";

  /** Warna background & border banner berdasarkan arah tren */
  const trendBg =
    trend.trend === "NAIK"
      ? "bg-green-50 border-green-200"
      : trend.trend === "TURUN"
      ? "bg-red-50 border-red-200"
      : "bg-yellow-50 border-yellow-200";

  // Log render TrendChart dengan data metrik
  logger.info("TrendChart", "Render chart", {
    trend: trend.trend,
    avgKnowledge: features.avgKnowledge,
    avgSkills: features.avgSkills,
    scoreDelta: features.scoreDelta,
    semesterCount: features.semesterCount,
    totalAbsence: features.totalAbsence,
  });

  return (
    <div className="space-y-4">
      {/* ========== Trend Banner ========== */}
      {/* Banner informasi tren — warna sesuai arah (hijau/merah/kuning) */}
      <div className={`p-3 rounded-lg border ${trendBg}`}>
        <p className={`text-sm font-medium ${trendColor}`}>{trend.description}</p>
      </div>

      {/* ========== Metric Cards ========== */}
      {/* Grid 4 kartu metrik utama */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Rata-rata Nilai Pengetahuan */}
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <p className="text-xs text-gray-500">Rata-rata Pengetahuan</p>
          <p className="text-lg font-bold text-gray-900">{features.avgKnowledge}</p>
        </div>

        {/* Rata-rata Nilai Keterampilan */}
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <p className="text-xs text-gray-500">Rata-rata Keterampilan</p>
          <p className="text-lg font-bold text-gray-900">{features.avgSkills}</p>
        </div>

        {/* Delta Semester — selisih nilai antar semester */}
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <p className="text-xs text-gray-500">Delta Semester</p>
          <p
            className={`text-lg font-bold ${
              features.scoreDelta >= 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            {features.scoreDelta >= 0 ? "+" : ""}
            {features.scoreDelta}
          </p>
        </div>

        {/* Volatilitas Skor */}
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <p className="text-xs text-gray-500">Volatilitas</p>
          <p className="text-lg font-bold text-gray-900">{features.scoreVolatility}</p>
        </div>
      </div>

      {/* ========== Bar Chart ========== */}
      {/* Bar chart sederhana — hanya tampil jika ada data semester */}
      {features.semesterCount > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm font-medium text-gray-700 mb-3">
            Riwayat Nilai ({features.semesterCount} semester)
          </p>

          {/* Container 4 bar: Pengetahuan, Keterampilan, Absensi, Prestasi */}
          <div className="flex items-end gap-2 h-24">
            {/* Bar: Rata-rata Pengetahuan */}
            <div className="flex-1 flex flex-col items-center justify-end">
              <span className="text-xs font-medium text-blue-600 mb-1">
                {features.avgKnowledge}
              </span>
              <div
                className="w-full bg-blue-500 rounded-t"
                style={{ height: `${Math.min(features.avgKnowledge, 100)}%` }}
              />
              <span className="text-xs text-gray-400 mt-1">Pengetahuan</span>
            </div>

            {/* Bar: Rata-rata Keterampilan */}
            <div className="flex-1 flex flex-col items-center justify-end">
              <span className="text-xs font-medium text-green-600 mb-1">
                {features.avgSkills}
              </span>
              <div
                className="w-full bg-green-500 rounded-t"
                style={{ height: `${Math.min(features.avgSkills, 100)}%` }}
              />
              <span className="text-xs text-gray-400 mt-1">Keterampilan</span>
            </div>

            {/* Bar: Total Absensi (dikalikan 10 agar terlihat proporsional) */}
            <div className="flex-1 flex flex-col items-center justify-end">
              <span className="text-xs font-medium text-gray-600 mb-1">
                {features.totalAbsence}
              </span>
              <div
                className="w-full bg-orange-400 rounded-t"
                style={{
                  height: `${Math.min(features.totalAbsence * 10, 100)}%`,
                }}
              />
              <span className="text-xs text-gray-400 mt-1">Absensi</span>
            </div>

            {/* Bar: Jumlah Prestasi (dikalikan 25 agar terlihat proporsional) */}
            <div className="flex-1 flex flex-col items-center justify-end">
              <span className="text-xs font-medium text-purple-600 mb-1">
                {features.achievementCount}
              </span>
              <div
                className="w-full bg-purple-500 rounded-t"
                style={{
                  height: `${Math.min(features.achievementCount * 25, 100)}%`,
                }}
              />
              <span className="text-xs text-gray-400 mt-1">Prestasi</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
