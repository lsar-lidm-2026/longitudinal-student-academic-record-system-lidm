"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MagicCard } from "@/components/ui/magic-card";
import { Input } from "@/components/ui/input";
import { BorderBeam } from "@/components/ui/border-beam";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";
import type { Student } from "@/types";

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  function refresh() {
    setLoading(true);
    setError(null);
    api.handleResponse(api.get<Student[]>("/students"))
      .then((data) => setStudents(data))
      .catch((err) => setError(err.message || "Gagal memuat data siswa"))
      .finally(() => setLoading(false));
  }

  useEffect(() => { refresh(); }, []);

  const filtered = students.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const pageSize = 50;
  const [page, setPage] = useState(1);
  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginatedStudents = filtered.slice(0, page * pageSize);
  const hasMore = paginatedStudents.length < filtered.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-500">
        <p>{error}</p>
        <button
          onClick={refresh}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="relative">
        <BorderBeam className="absolute inset-0 rounded-2xl" duration={10} />
        <div className="relative p-6 bg-gradient-to-br from-white via-blue-50/30 rounded-2xl border border-blue-100/50">
          <h1 className="text-2xl font-bold text-gray-900">Data Siswa</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {students.length} siswa terdaftar
          </p>
        </div>
      </div>

      <Input
        placeholder="Cari siswa..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <MagicCard className="p-0 overflow-hidden" gradientSize={300}>
        <div className="p-4 pb-0">
          <h3 className="text-sm font-medium text-muted-foreground">Daftar Siswa</h3>
        </div>
        <Separator className="mt-3" />
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Nama</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground hidden sm:table-cell">NIS</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground hidden md:table-cell">NISN</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground hidden lg:table-cell">Kelas</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {paginatedStudents.map((student) => (
              <tr key={student.id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                <td className="py-3 px-4 text-sm font-medium text-gray-900">{student.name}</td>
                <td className="py-3 px-4 text-sm text-gray-500 hidden sm:table-cell">{student.nis}</td>
                <td className="py-3 px-4 text-sm text-gray-500 hidden md:table-cell">{student.nisn}</td>
                <td className="py-3 px-4 text-sm text-gray-500 hidden lg:table-cell">{student.class?.name || "-"}</td>
                <td className="py-3 px-4 text-right">
                  <Link
                    href={`/students/${student.id}`}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium hover:underline"
                  >
                    Detail →
                  </Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  {search ? "Tidak ada siswa dengan nama tersebut" : "Tidak ada data siswa"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {hasMore && (
          <div className="px-4 py-3 border-t border-gray-100 text-center">
            <button
              onClick={() => setPage((p) => p + 1)}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium hover:underline"
            >
              Muat lebih banyak ({filtered.length - paginatedStudents.length} tersisa)
            </button>
          </div>
        )}
      </MagicCard>
    </div>
  );
}
