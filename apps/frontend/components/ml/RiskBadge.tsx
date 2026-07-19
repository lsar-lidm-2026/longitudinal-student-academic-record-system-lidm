/**
 * RiskBadge — Komponen badge visual untuk menampilkan level risiko siswa.
 * ======================================================================
 *
 * Cara Kerja:
 * 1. Menerima props `level` ("AMAN" | "WASPADA" | "KRITIS") dan `score` opsional.
 * 2. Memetakan level ke warna dan label yang sesuai melalui object lookup `colors` dan `labels`.
 * 3. Menampilkan badge berbentuk pill dengan indikator dot berwarna + teks label.
 * 4. Jika `score` diberikan, angka ditampilkan dalam kurung setelah label.
 *
 * Alur:
 * - Parent menentukan level risiko (misal dari API ML prediction).
 * - RiskBadge merender span dengan class warna sesuai level.
 * - Dot indikator: hijau (AMAN), kuning (WASPADA), merah (KRITIS).
 *
 * @module RiskBadge
 */

"use client";

import { logger } from "@/lib/logger";

/** Props yang diterima komponen RiskBadge */
interface RiskBadgeProps {
  /** Level risiko siswa */
  level: "AMAN" | "WASPADA" | "KRITIS";
  /** Skor risiko numerik (opsional) */
  score?: number;
}

/** Mapping level ke class Tailwind untuk warna badge */
const colors: Record<RiskBadgeProps["level"], string> = {
  AMAN: "bg-green-100 text-green-700 border-green-200",
  WASPADA: "bg-yellow-100 text-yellow-700 border-yellow-200",
  KRITIS: "bg-red-100 text-red-700 border-red-200",
};

/** Mapping level ke label yang ditampilkan */
const labels: Record<RiskBadgeProps["level"], string> = {
  AMAN: "Aman",
  WASPADA: "Waspada",
  KRITIS: "Kritis",
};

/**
 * RiskBadge — badge risiko berbentuk pill dengan indikator warna.
 * @param {RiskBadgeProps} props - level risiko + skor opsional
 */
export function RiskBadge({ level, score }: RiskBadgeProps) {
  // Log hanya saat badge dirender dengan level tertentu
  logger.debug("RiskBadge", "Render badge", { level, score });

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${colors[level]}`}
    >
      {/* Dot indikator warna — hijau/kuning/merah sesuai level */}
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          level === "AMAN"
            ? "bg-green-500"
            : level === "WASPADA"
            ? "bg-yellow-500"
            : "bg-red-500"
        }`}
      />

      {/* Label level */}
      {labels[level]}

      {/* Skor numerik dalam kurung — hanya tampil jika disediakan */}
      {score !== undefined && ` (${score})`}
    </span>
  );
}
