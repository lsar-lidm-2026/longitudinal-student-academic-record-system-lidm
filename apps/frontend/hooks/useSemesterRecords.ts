"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import type { SemesterRecord, AcademicYear } from "@/types";

interface UseSemesterRecordsResult {
  records: SemesterRecord[];
  academicYears: AcademicYear[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useSemesterRecords(studentId: string): UseSemesterRecordsResult {
  const [records, setRecords] = useState<SemesterRecord[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    setError(null);

    const [recordsRes, yearsRes] = await Promise.all([
      api.get<SemesterRecord[]>(`/students/${studentId}/semester-records`),
      api.get<AcademicYear[]>("/academic-years"),
    ]);

    if (recordsRes.success && recordsRes.data) {
      setRecords(recordsRes.data as SemesterRecord[]);
    } else {
      setError(recordsRes.error?.message || "Gagal memuat data semester");
    }

    if (yearsRes.success && yearsRes.data) {
      setAcademicYears(yearsRes.data as AcademicYear[]);
    }

    setLoading(false);
  }, [studentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { records, academicYears, loading, error, refresh: fetchData };
}
