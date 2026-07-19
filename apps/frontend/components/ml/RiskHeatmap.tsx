/**
 * RiskHeatmap — Komponen dashboard ringkasan risiko siswa berbasis ML.
 * ====================================================================
 *
 * Cara Kerja:
 * 1. Menerima props `results` (array RiskItem) dan `summary` (object agregat).
 * 2. Menampilkan 4 kartu ringkasan: Total Siswa, Kritis, Waspada, Aman.
 * 3. Menampilkan bar distribusi risiko horizontal dengan warna proporsional.
 * 4. Setiap siswa ditampilkan sebagai kartu link ke halaman detail siswa.
 * 5. Setiap kartu siswa menampilkan: nama, trend icon, RiskBadge, dan faktor risiko.
 *
 * Alur:
 * - Parent mengambil data hasil ML prediction dari API.
 * - Summary dihitung dari total, kritis, waspada, aman.
 * - RiskHeatmap merender summary cards → distribution bar → student list.
 * - Setiap student item bisa diklik menuju `/students/{studentId}`.
 *
 * @module RiskHeatmap
 */

"use client";

import Link from "next/link";
import { RiskBadge } from "./RiskBadge";
import { logger } from "@/lib/logger";

/** Data satu siswa dalam hasil risk assessment */
interface RiskItem {
  /** ID unik siswa */
  studentId: string;
  /** Nama siswa */
  name: string;
  /** Data hasil analisis risiko */
  risk: {
    /** Level risiko */
    level: "AMAN" | "WASPADA" | "KRITIS";
    /** Skor risiko numerik (0-100) */
    score: number;
    /** Array faktor-faktor penyebab risiko */
    factors: string[];
    /** Array rekomendasi untuk mitigasi */
    recommendations: string[];
  };
  /** Data tren akademik siswa */
  trend: {
    /** Arah tren: NAIK / STABIL / TURUN */
    trend: "NAIK" | "STABIL" | "TURUN";
    /** Deskripsi tren dalam bahasa natural */
    description: string;
  };
}

/** Props yang diterima komponen RiskHeatmap */
interface RiskHeatmapProps {
  /** Array hasil risk assessment per siswa */
  results: RiskItem[];
  /** Ringkasan agregat seluruh siswa */
  summary: {
    /** Total siswa yang dianalisis */
    total: number;
    /** Jumlah siswa dengan level KRITIS */
    kritis: number;
    /** Jumlah siswa dengan level WASPADA */
    waspada: number;
    /** Jumlah siswa dengan level AMAN */
    aman: number;
  };
}

/** Icon untuk setiap arah tren */
const trendIcons: Record<string, string> = {
  NAIK: "\uD83D\uDCC8",   // 📈
  STABIL: "\u27A1\uFE0F", // ➡️
  TURUN: "\uD83D\uDCC9",  // 📉
};

/**
 * RiskHeatmap — dashboard ringkasan risiko siswa.
 * @param {RiskHeatmapProps} props - results + summary dari ML prediction
 */
export function RiskHeatmap({ results, summary }: RiskHeatmapProps) {
  // Log saat komponen dirender dengan data
  logger.info("RiskHeatmap", "Render heatmap", {
    totalSiswa: summary.total,
    kritis: summary.kritis,
    waspada: summary.waspada,
    aman: summary.aman,
    resultsCount: results.length,
  });

  return (
    <div className="space-y-6">
      {/* ========== Summary Cards ========== */}
      {/* Grid 4 kolom: Total, Kritis, Waspada, Aman */}
      <div className="grid grid-cols-4 gap-3">
        {/* Total Siswa */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{summary.total}</p>
          <p className="text-xs text-gray-500">Total Siswa</p>
        </div>

        {/* Kritis — border merah */}
        <div className="bg-white rounded-xl border border-red-200 p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{summary.kritis}</p>
          <p className="text-xs text-red-500">Kritis</p>
        </div>

        {/* Waspada — border kuning */}
        <div className="bg-white rounded-xl border border-yellow-200 p-4 text-center">
          <p className="text-2xl font-bold text-yellow-600">{summary.waspada}</p>
          <p className="text-xs text-yellow-500">Waspada</p>
        </div>

        {/* Aman — border hijau */}
        <div className="bg-white rounded-xl border border-green-200 p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{summary.aman}</p>
          <p className="text-xs text-green-500">Aman</p>
        </div>
      </div>

      {/* ========== Risk Distribution Bar ========== */}
      {/* Bar horizontal proporsional: merah (kritis) → kuning (waspada) → hijau (aman) */}
      <div className="h-4 rounded-full overflow-hidden flex bg-gray-100">
        {summary.kritis > 0 && (
          <div
            className="bg-red-500 transition-all"
            style={{ width: `${(summary.kritis / summary.total) * 100}%` }}
            title={`Kritis: ${summary.kritis}`}
          />
        )}
        {summary.waspada > 0 && (
          <div
            className="bg-yellow-500 transition-all"
            style={{ width: `${(summary.waspada / summary.total) * 100}%` }}
            title={`Waspada: ${summary.waspada}`}
          />
        )}
        {summary.aman > 0 && (
          <div
            className="bg-green-500 transition-all"
            style={{ width: `${(summary.aman / summary.total) * 100}%` }}
            title={`Aman: ${summary.aman}`}
          />
        )}
      </div>

      {/* ========== Student List ========== */}
      <div className="space-y-2">
        {results.map((item) => (
          <Link
            key={item.studentId}
            href={`/students/${item.studentId}`}
            className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all"
          >
            {/* Baris header: nama siswa + trend icon + RiskBadge */}
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-gray-900">{item.name}</span>
              <div className="flex items-center gap-2">
                {/* Icon arah tren dengan tooltip deskripsi */}
                <span title={item.trend.description}>
                  {trendIcons[item.trend.trend]}
                </span>
                {/* Badge level risiko */}
                <RiskBadge level={item.risk.level} score={item.risk.score} />
              </div>
            </div>

            {/* Faktor risiko — ditampilkan sebagai tag abu-abu */}
            {item.risk.factors.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {item.risk.factors.map((f, i) => (
                  <span
                    key={i}
                    className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded"
                  >
                    {f}
                  </span>
                ))}
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
