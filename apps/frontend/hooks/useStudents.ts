/**
 * useStudents — Custom hook untuk memuat daftar siswa dengan filter pencarian/kelas.
 * ================================================================================
 *
 * Cara Kerja:
 * 1. Hook menerima `options` berisi `search` (query pencarian) dan/atau `classId`.
 * 2. Setiap kali options berubah, `fetchStudents()` otomatis dipanggil via useEffect.
 * 3. `fetchStudents()`:
 *    a. Bangun query string dari options (URLSearchParams)
 *    b. Panggil GET /students?search=...&classId=...
 *    c. Jika sukses → setStudents(data)
 *    d. Jika gagal → setError(pesan)
 *    e. Finally → setLoading(false)
 * 4. Return state: students, loading, error, refresh.
 *
 * Alur Lengkap:
 *   Komponen memanggil useStudents({ search, classId })
 *       │
 *       ├─ [mount / options change] useEffect → fetchStudents()
 *       │       │
 *       │       └─ fetchStudents()
 *       │              ├─ setLoading(true), setError(null)
 *       │              ├─ Bangun URLSearchParams dari options
 *       │              ├─ GET /students?search=xxx&classId=xxx
 *       │              ├─ sukses → setStudents(data)
 *       │              └─ gagal → setError
 *       │              └─ setLoading(false)
 *       │
 *       └─ return { students, loading, error, refresh }
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { logger } from "@/lib/logger";
import type { Student } from "@/types";

const MODULE = "useStudents"; /** Nama module untuk logger */

/** Interface untuk opsi filter yang bisa dikirim ke hook */
interface UseStudentsOptions {
  search?: string;   /** Filter berdasarkan nama/NISN (query string) */
  classId?: string;  /** Filter berdasarkan kelas */
}

/** Interface untuk return value hook */
interface UseStudentsResult {
  students: Student[]; /** Daftar siswa hasil fetch */
  loading: boolean;    /** Status loading */
  error: string | null; /** Pesan error jika gagal */
  refresh: () => void;  /** Trigger manual refetch */
}

/**
 * useStudents — Hook untuk memuat daftar siswa dengan filter opsional.
 *
 * @param options - Filter pencarian { search?, classId? }
 * @returns Object { students, loading, error, refresh }
 */
export function useStudents(options?: UseStudentsOptions): UseStudentsResult {
  // State daftar siswa
  const [students, setStudents] = useState<Student[]>([]);
  // Status loading
  const [loading, setLoading] = useState(true);
  // Pesan error
  const [error, setError] = useState<string | null>(null);

  /**
   * fetchStudents — Mengambil daftar siswa dari API dengan filter.
   * Membangun query string berdasarkan options yang diberikan.
   * Dependency: options?.search, options?.classId — refetch jika berubah.
   */
  const fetchStudents = useCallback(async () => {
    logger.info(MODULE, "Memulai fetch siswa", { search: options?.search, classId: options?.classId });
    setLoading(true);
    setError(null);

    // Bangun query string dari filter yang tersedia
    const params = new URLSearchParams();
    if (options?.search) params.set("search", options.search);
    if (options?.classId) params.set("classId", options.classId);

    const query = params.toString();
    const endpoint = `/students${query ? `?${query}` : ""}`;
    logger.debug(MODULE, "Endpoint", { endpoint });

    // Request ke API
    const res = await api.get<Student[]>(endpoint);

    if (res.success && res.data) {
      // Fetch sukses
      const data = res.data as Student[];
      logger.debug(MODULE, "Siswa diterima", { count: data.length, search: options?.search });
      setStudents(data);
    } else {
      // Fetch gagal
      const errMsg = res.error?.message || "Gagal memuat data siswa";
      logger.error(MODULE, "Gagal fetch siswa", { error: errMsg, search: options?.search });
      setError(errMsg);
    }

    setLoading(false);
    logger.debug(MODULE, "Fetch selesai");
  }, [options?.search, options?.classId]); // Re-create saat filter berubah

  // Effect: panggil fetchStudents saat komponen mount atau options berubah
  useEffect(() => {
    logger.debug(MODULE, "Effect dipicu", { search: options?.search, classId: options?.classId });
    fetchStudents();
  }, [fetchStudents]); // fetchStudents berubah saat options berubah

  /**
   * Return value:
   * - students: daftar Student
   * - loading: boolean
   * - error: string | null
   * - refresh: alias ke fetchStudents untuk manual refetch
   */
  return { students, loading, error, refresh: fetchStudents };
}
