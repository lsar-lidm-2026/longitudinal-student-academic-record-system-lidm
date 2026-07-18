"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  CheckCircle,
  Clock,
  ArrowRightLeft,
  Search,
  SlidersHorizontal,
  Download,
  Plus,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  User,
} from "lucide-react";
import { api } from "@/lib/api";
import type { Student } from "@/types";

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

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
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.nisn.includes(search) ||
    s.nis.includes(search)
  );

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginatedStudents = filtered.slice((page - 1) * pageSize, page * pageSize);

  // Reset page on search
  useEffect(() => { setPage(1); }, [search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
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

  const totalStudents = students.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Data Siswa</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Kelola informasi biodata dan status akademik siswa secara terpusat.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="inline-flex items-center gap-2 px-3.5 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            <Download className="w-4 h-4" />
            Ekspor Data
          </button>
          <button className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">
            <Plus className="w-4 h-4" />
            Tambah Siswa
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MiniStat icon={Users} label="Total Siswa" value={totalStudents} iconBg="bg-blue-50" iconColor="text-blue-500" />
        <MiniStat icon={CheckCircle} label="Siswa Aktif" value={totalStudents} iconBg="bg-green-50" iconColor="text-green-500" />
        <MiniStat icon={Clock} label="Siswa Cuti" value={0} iconBg="bg-amber-50" iconColor="text-amber-500" />
        <MiniStat icon={ArrowRightLeft} label="Siswa Pindah" value={0} iconBg="bg-gray-50" iconColor="text-gray-500" />
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Cari berdasarkan Nama atau NISN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 h-10 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-gray-400"
          />
        </div>
        <select className="h-10 px-3 border border-gray-200 rounded-lg text-sm text-gray-600 bg-white outline-none focus:border-blue-400">
          <option>Semua Kelas</option>
        </select>
        <select className="h-10 px-3 border border-gray-200 rounded-lg text-sm text-gray-600 bg-white outline-none focus:border-blue-400">
          <option>Semua Status</option>
        </select>
        <button className="h-10 px-3 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition-colors flex items-center gap-1.5">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filter
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider w-10">#</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Siswa</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden md:table-cell">NISN</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden lg:table-cell">Kelas</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden xl:table-cell">NIS</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden sm:table-cell">Status</th>
              <th className="text-center py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider w-14">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {paginatedStudents.map((student, idx) => (
              <tr key={student.id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                <td className="py-3 px-4 text-sm text-gray-400">
                  {(page - 1) * pageSize + idx + 1}
                </td>
                <td className="py-3 px-4">
                  <Link href={`/students/${student.id}`} className="flex items-center gap-3 group">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-gray-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                        {student.name}
                      </p>
                    </div>
                  </Link>
                </td>
                <td className="py-3 px-4 hidden md:table-cell">
                  <span className="text-sm text-gray-500 font-mono">{student.nisn}</span>
                </td>
                <td className="py-3 px-4 hidden lg:table-cell">
                  <span className="text-sm text-gray-600">{student.class?.name || "-"}</span>
                </td>
                <td className="py-3 px-4 hidden xl:table-cell">
                  <span className="text-sm text-gray-500">{student.nis}</span>
                </td>
                <td className="py-3 px-4 hidden sm:table-cell">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-50 text-green-600 border border-green-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    Aktif
                  </span>
                </td>
                <td className="py-3 px-4 text-center">
                  <Link
                    href={`/students/${student.id}`}
                    className="w-8 h-8 inline-flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="py-12 text-center text-sm text-gray-400">
                  {search ? "Tidak ada siswa dengan nama tersebut" : "Tidak ada data siswa"}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {filtered.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Menampilkan <strong>{(page - 1) * pageSize + 1}-{Math.min(page * pageSize, filtered.length)}</strong> dari {filtered.length} data siswa
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-gray-500"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                      page === pageNum
                        ? "bg-blue-600 text-white"
                        : "text-gray-500 hover:bg-gray-100"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              {totalPages > 5 && page < totalPages - 2 && (
                <>
                  <span className="text-gray-400 px-1">...</span>
                  <button
                    onClick={() => setPage(totalPages)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-sm text-gray-500 hover:bg-gray-100 transition-colors"
                  >
                    {totalPages}
                  </button>
                </>
              )}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-gray-500"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  iconBg,
  iconColor,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div>
        <p className="text-[11px] text-gray-400 uppercase tracking-wider font-medium">{label}</p>
        <p className="text-xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}
