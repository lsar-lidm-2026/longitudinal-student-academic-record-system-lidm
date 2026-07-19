/**
 * useSemesterRecords — Custom hook untuk memuat data semester records dan academic years.
 * =======================================================================================
 *
 * Cara Kerja:
 * 1. Hook menerima `studentId` sebagai parameter.
 * 2. Saat mount atau studentId berubah, `fetchData()` dipanggil via useEffect.
 * 3. `fetchData()` melakukan dua request API paralel (Promise.all):
 *    a. GET /students/{studentId}/semester-records → daftar SemesterRecord
 *    b. GET /academic-years → daftar AcademicYear untuk dropdown/picker
 * 4. Jika salah satu request gagal, error diset sesuai.
 * 5. Return state: records, academicYears, loading, error, refresh.
 *
 * Alur Lengkap:
 *   Komponen memanggil useSemesterRecords(studentId)
 *       │
 *       ├─ [mount / studentId change] useEffect → fetchData()
 *       │       │
 *       │       └─ fetchData()
 *       │              ├─ Jika !studentId → return early
 *       │              ├─ setLoading(true), setError(null)
 *       │              ├─ Promise.all([ GET records, GET years ])
 *       │              ├─ Parse response masing-masing
 *       │              │   ├─ Sukses → setRecords / setAcademicYears
 *       │              │   └─ Gagal → setError
 *       │              └─ setLoading(false)
 *       │
 *       └─ return { records, academicYears, loading, error, refresh }
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { logger } from "@/lib/logger";
import type { SemesterRecord, AcademicYear } from "@/types";

const MODULE = "useSemesterRecords"; /** Nama module untuk logger */

/** Interface untuk return value hook */
interface UseSemesterRecordsResult {
  records: SemesterRecord[];         /** Daftar semester records siswa */
  academicYears: AcademicYear[];      /** Daftar tahun ajaran untuk referensi */
  loading: boolean;                   /** Status loading */
  error: string | null;               /** Pesan error jika gagal fetch */
  refresh: () => void;                /** Trigger manual refetch */
}

/**
 * useSemesterRecords — Hook untuk memuat semester records + academic years.
 *
 * @param studentId - ID siswa yang semester records-nya akan diambil
 * @returns Object { records, academicYears, loading, error, refresh }
 */
export function useSemesterRecords(studentId: string): UseSemesterRecordsResult {
  // State utama: daftar semester records
  const [records, setRecords] = useState<SemesterRecord[]>([]);
  // State untuk daftar tahun ajaran (digunakan di form/dropdown)
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  // Status loading
  const [loading, setLoading] = useState(true);
  // Pesan error jika gagal
  const [error, setError] = useState<string | null>(null);

  /**
   * fetchData — Mengambil data semester records dan academic years dari API.
   * Menggunakan Promise.all untuk parallel request.
   * Dependency: studentId — refetch jika studentId berubah.
   */
  const fetchData = useCallback(async () => {
    // Validasi: jangan fetch jika studentId kosong
    if (!studentId) {
      logger.warn(MODULE, "fetchData dipanggil tanpa studentId — skip");
      return;
    }

    logger.info(MODULE, "Memulai fetch semester records", { studentId });
    setLoading(true);
    setError(null);

    // Dua request paralel untuk efisiensi
    const [recordsRes, yearsRes] = await Promise.all([
      api.get<SemesterRecord[]>(`/students/${studentId}/semester-records`),
      api.get<AcademicYear[]>("/academic-years"),
    ]);

    // Proses response semester records
    if (recordsRes.success && recordsRes.data) {
      const data = recordsRes.data as SemesterRecord[];
      logger.debug(MODULE, "Semester records diterima", { count: data.length, studentId });
      setRecords(data);
    } else {
      const errMsg = recordsRes.error?.message || "Gagal memuat data semester";
      logger.error(MODULE, "Gagal fetch semester records", { studentId, error: errMsg });
      setError(errMsg);
    }

    // Proses response academic years
    if (yearsRes.success && yearsRes.data) {
      const data = yearsRes.data as AcademicYear[];
      logger.debug(MODULE, "Academic years diterima", { count: data.length });
      setAcademicYears(data);
    } else {
      logger.warn(MODULE, "Gagal fetch academic years (non-critical)");
    }

    setLoading(false);
    logger.debug(MODULE, "Fetch selesai", { studentId });
  }, [studentId]); // Re-create callback saat studentId berubah

  // Effect: panggil fetchData saat komponen mount atau studentId berubah
  useEffect(() => {
    logger.debug(MODULE, "Effect dipicu", { studentId });
    fetchData();
  }, [fetchData]); // fetchData berubah saat studentId berubah

  /**
   * Return value:
   * - records: daftar SemesterRecord
   * - academicYears: daftar AcademicYear
   * - loading: boolean
   * - error: string | null
   * - refresh: alias ke fetchData untuk manual refetch
   */
  return { records, academicYears, loading, error, refresh: fetchData };
}
