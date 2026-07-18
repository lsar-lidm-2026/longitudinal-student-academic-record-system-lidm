"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import type { Student } from "@/types";

interface UseStudentsOptions {
  search?: string;
  classId?: string;
}

interface UseStudentsResult {
  students: Student[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useStudents(options?: UseStudentsOptions): UseStudentsResult {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (options?.search) params.set("search", options.search);
    if (options?.classId) params.set("classId", options.classId);

    const query = params.toString();
    const res = await api.get<Student[]>(`/students${query ? `?${query}` : ""}`);

    if (res.success && res.data) {
      setStudents(res.data as Student[]);
    } else {
      setError(res.error?.message || "Gagal memuat data siswa");
    }
    setLoading(false);
  }, [options?.search, options?.classId]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  return { students, loading, error, refresh: fetchStudents };
}
