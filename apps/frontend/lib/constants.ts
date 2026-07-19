/**
 * Constants — shared constants across the LSAR frontend.
 * ======================================================
 *
 * Centralize all magic strings, enums, and fixed lookup tables here
 * to avoid duplication between components and pages.
 *
 * Cara pakai:
 *   import { SUBJECTS } from "@/lib/constants";
 *
 * Logger:
 * - Tidak ada logger di sini — murni data deklaratif.
 */

/** Daftar tetap mata pelajaran SD — 8 mapel sesuai kurikulum nasional */
export const SUBJECTS: readonly string[] = [
  "Pendidikan Agama",
  "Pendidikan Pancasila",
  "Bahasa Indonesia",
  "Matematika",
  "IPA",
  "IPS",
  "Seni Budaya",
  "PJOK",
] as const;
