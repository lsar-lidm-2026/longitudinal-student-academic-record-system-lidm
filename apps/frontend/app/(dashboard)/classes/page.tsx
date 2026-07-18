"use client";

import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { MagicCard } from "@/components/ui/magic-card";
import { Badge } from "@/components/ui/badge";
import { BorderBeam } from "@/components/ui/border-beam";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";
import type { ClassItem, User } from "@/types";

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get<ClassItem[]>("/classes"),
      api.get<User[]>("/auth/users"),
    ])
      .then(([classesRes, usersRes]) => {
        if (classesRes.success && classesRes.data) setClasses(classesRes.data as ClassItem[]);
        if (usersRes.success && usersRes.data) {
          const guru = (usersRes.data as User[]).filter((u) => u.role === "GURU");
          setUsers(guru);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Gagal memuat data kelas");
        setLoading(false);
      });
  }

  useEffect(() => { refresh(); }, []);

  async function assignTeacher(classId: string, teacherId: string) {
    try {
      await api.patch(`/classes/${classId}/homeroom-teacher`, { teacherId });
      const res = await api.get<ClassItem[]>("/classes");
      if (res.success && res.data) setClasses(res.data as ClassItem[]);
    } catch (err: any) {
      // silent catch — UI tetap konsisten
    }
  }

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
    <AuthGuard roles={["ADMINISTRATOR"]}>
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="relative">
        <BorderBeam className="absolute inset-0 rounded-2xl" duration={10} />
        <div className="relative p-6 bg-gradient-to-br from-white via-green-50/30 rounded-2xl border border-green-100/50">
          <h1 className="text-2xl font-bold text-gray-900">Manajemen Kelas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {classes.length} kelas terdaftar
          </p>
        </div>
      </div>

      <MagicCard className="p-0 overflow-hidden" gradientSize={300}>
        <div className="p-4 pb-0">
          <h3 className="text-sm font-medium text-muted-foreground">Daftar Kelas</h3>
        </div>
        <Separator className="mt-3" />
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Kelas</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground hidden sm:table-cell">Tahun Ajaran</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Siswa</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Wali Kelas</th>
            </tr>
          </thead>
          <tbody>
            {classes.map((cls) => (
              <tr key={cls.id} className="border-b border-gray-50 hover:bg-green-50/30 transition-colors">
                <td className="py-3 px-4 text-sm font-medium text-gray-900">{cls.name}</td>
                <td className="py-3 px-4 text-sm text-gray-500 hidden sm:table-cell">{cls.academicYear?.year}</td>
                <td className="py-3 px-4 text-sm text-gray-500">{cls._count?.students || 0}</td>
                <td className="py-3 px-4">
                  <select
                    className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white hover:border-gray-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
                    value={cls.homeroomTeacherId || ""}
                    onChange={(e) => assignTeacher(cls.id, e.target.value)}
                  >
                    <option value="">-</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {classes.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                  Belum ada kelas
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </MagicCard>
    </div>
    </AuthGuard>
  );
}
