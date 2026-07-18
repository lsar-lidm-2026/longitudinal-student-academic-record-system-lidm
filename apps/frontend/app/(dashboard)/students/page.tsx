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
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.get<Student[]>("/students").then((res) => {
      if (res.success && res.data) {
        setStudents(res.data as Student[]);
      }
      setLoading(false);
    });
  }, []);

  const filtered = students.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
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
            {filtered.map((student) => (
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
      </MagicCard>
    </div>
  );
}
