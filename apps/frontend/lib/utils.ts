/**
 * FILE: lib/utils.ts
 * ==================
 * Utility functions umum yang digunakan di seluruh aplikasi frontend.
 *
 * Cara Kerja:
 * 1. cn() adalah wrapper yang menggabungkan clsx + tailwind-merge untuk class name management.
 * 2. clsx meng-handle conditional class names (string, array, object, falsy filtering).
 * 3. twMerge menangani konflik class Tailwind — class terakhir menang.
 *
 * Alur:
 * 1. Terima ...inputs (string, array, object, false/undefined/null).
 * 2. clsx() → filter falsy values, gabungkan jadi string.
 * 3. twMerge() → resolve konflik Tailwind utilities (e.g., "px-4 px-2" → "px-2").
 * 4. Return string class name yang sudah di-merge.
 *
 * Contoh:
 *   cn("px-4", "py-2")                     // "px-4 py-2"
 *   cn("px-4", false && "hidden")          // "px-4"
 *   cn("px-4", isActive ? "bg-blue-500" : "bg-gray-200")
 *
 * @module Utils
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge class names dengan Tailwind conflict resolution.
 *
 * @param inputs - ClassValue array (string, array, object, boolean) — falsy values diabaikan
 * @returns String class name yang sudah di-merge dan bebas konflik Tailwind
 *
 * @example
 *   cn("px-4 py-2", "px-2")    // "py-2 px-2" (px-2 menang)
 *   cn("text-red-500", condition && "text-blue-500")
 */
export function cn(...inputs: ClassValue[]) {
  // 1. clsx: filter & gabung semua class names
  // 2. twMerge: resolve konflik Tailwind utilities
  return twMerge(clsx(inputs));
}

/**
 * formatRelativeTime — Mengkonversi string ISO date ke waktu relatif Bahasa Indonesia.
 *
 * Aturan:
 * - < 1 menit: "Baru saja"
 * - < 60 menit: "X menit lalu"
 * - < 24 jam: "X jam lalu"
 * - < 7 hari: "X hari lalu"
 * - else: formatted date "DD/MM/YYYY HH:mm"
 *
 * @param dateString - ISO date string (e.g., "2026-07-19T09:00:00.000Z")
 * @returns String waktu relatif dalam Bahasa Indonesia
 */
export function formatRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();

  // Pastikan diffMs tidak negatif (data masa depan)
  const diffSeconds = Math.max(0, Math.floor(diffMs / 1000));
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return "Baru saja";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} menit lalu`;
  }
  if (diffHours < 24) {
    return `${diffHours} jam lalu`;
  }
  if (diffDays < 7) {
    return `${diffDays} hari lalu`;
  }

  // Format tanggal lokal Indonesia
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}
