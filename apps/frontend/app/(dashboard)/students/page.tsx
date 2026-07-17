"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { api } from "../../../lib/api";
import type { Student } from "../../../types";

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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Data Siswa</h1>
      </div>

      <Input
        placeholder="Cari siswa..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <Card>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Nama</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">NIS</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">NISN</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Kelas</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((student) => (
              <tr key={student.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4 text-sm font-medium text-gray-900">{student.name}</td>
                <td className="py-3 px-4 text-sm text-gray-600">{student.nis}</td>
                <td className="py-3 px-4 text-sm text-gray-600">{student.nisn}</td>
                <td className="py-3 px-4 text-sm text-gray-600">{student.class?.name || "-"}</td>
                <td className="py-3 px-4 text-right">
                  <Link
                    href={`/students/${student.id}`}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Detail
                  </Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-sm text-gray-500">
                  Tidak ada data siswa
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
