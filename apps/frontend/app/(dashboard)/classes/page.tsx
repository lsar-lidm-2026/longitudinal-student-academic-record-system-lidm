"use client";

import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { api } from "@/lib/api";
import type { ClassItem, User as UserType } from "@/types";
import { BookOpen, Users, ShieldCheck, GraduationCap } from "lucide-react";

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  function refresh() {
    setLoading(true);
    setError(null);
    Promise.all([
      api.handleResponse(api.get<ClassItem[]>("/classes")),
      api.handleResponse(api.get<UserType[]>("/auth/users")),
    ])
      .then(([classesData, usersData]) => {
        setClasses(classesData);
        const guru = usersData.filter((u) => u.role === "GURU");
        setUsers(guru);
      })
      .catch((err) => {
        setError(err.message || "Gagal memuat data kelas");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    refresh();

    // Decode token to find current user role
    const token = localStorage.getItem("accessToken");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        setUserRole(payload.role);
      } catch {}
    }
  }, []);

  async function assignTeacher(classId: string, teacherId: string) {
    try {
      await api.patch(`/classes/${classId}/homeroom-teacher`, { teacherId });
      const data = await api.handleResponse(api.get<ClassItem[]>("/classes"));
      setClasses(data);
    } catch (err: any) {
      // silent catch — UI tetap konsisten
    }
  }

  const isAdm = userRole === "ADMINISTRATOR" || userRole === "OPERATOR_SEKOLAH";

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

  const totalClasses = classes.length;
  const totalStudents = classes.reduce((sum, c) => sum + (c._count?.students || 0), 0);

  return (
    <AuthGuard roles={["ADMINISTRATOR", "GURU", "KEPALA_SEKOLAH", "OPERATOR_SEKOLAH"]}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-gray-900">Buku Induk (Daftar Kelas)</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Kelola data kelas dan pembagian wali kelas terdaftar untuk rekam akademis siswa.
          </p>
        </div>

        {/* Mini Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">Total Kelas</p>
              <p className="text-xl font-bold text-gray-900">{totalClasses}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">Total Siswa Terdaftar</p>
              <p className="text-xl font-bold text-gray-900">{totalStudents}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
              <GraduationCap className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">Total Guru Wali Kelas</p>
              <p className="text-xl font-bold text-gray-900">{users.length}</p>
            </div>
          </div>
        </div>

        {/* Table Container */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Kelas</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden sm:table-cell">Tahun Ajaran</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Jumlah Siswa</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Wali Kelas</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((cls) => {
                const assignedTeacher = users.find((u) => u.id === cls.homeroomTeacherId);
                return (
                  <tr key={cls.id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                    <td className="py-3 px-4 text-sm font-semibold text-gray-950">{cls.name}</td>
                    <td className="py-3 px-4 text-sm text-gray-500 hidden sm:table-cell">{cls.academicYear?.year}</td>
                    <td className="py-3 px-4 text-sm text-gray-600 font-medium">{cls._count?.students || 0} siswa</td>
                    <td className="py-3 px-4">
                      {isAdm ? (
                        <select
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white hover:border-gray-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                          value={cls.homeroomTeacherId || ""}
                          onChange={(e) => assignTeacher(cls.id, e.target.value)}
                        >
                          <option value="">- Belum Ditugaskan -</option>
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-sm text-gray-700">
                          {assignedTeacher ? assignedTeacher.name : "-"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {classes.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-sm text-gray-400">
                    Belum ada kelas terdaftar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Info Box */}
        {!isAdm && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
            <ShieldCheck className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-700 leading-relaxed">
              Anda masuk dengan hak akses peninjau/wali kelas. Perubahan guru wali kelas hanya dapat dilakukan oleh **Administrator** atau **Operator Sekolah**.
            </p>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
