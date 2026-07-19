"use client";

/**
 * Cara kerja file (How this file works):
 * =======================================
 * Halaman ini menampilkan daftar kelas (Buku Induk / Daftar Kelas)
 * dengan informasi jumlah siswa, tahun ajaran, dan wali kelas.
 * Admin/Operator dapat menetapkan wali kelas via dropdown.
 *
 * Alur lengkap:
 * 1. useEffect memanggil refresh() saat mount.
 * 2. refresh() mengambil 3 data secara paralel:
 *    - /classes → daftar kelas
 *    - /users → daftar semua user (difilter hanya role GURU untuk opsi wali kelas)
 *    - /auth/me → role user yang sedang login
 * 3. Tabel kelas menampilkan: Nama Kelas, Tahun Ajaran, Jumlah Siswa,
 *    dan Wali Kelas (dropdown untuk admin/operator, teks biasa untuk lainnya).
 * 4. Jika user adalah ADMINISTRATOR atau OPERATOR_SEKOLAH (isAdm),
 *    dropdown wali kelas bisa diubah, dan perubahan disimpan via PATCH.
 * 5. Untuk non-admin, ditampilkan info box bahwa hanya admin/operator
 *    yang bisa mengubah wali kelas.
 */

import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { api } from "@/lib/api";
import { logger } from "@/lib/logger";
import type { ClassItem, User as UserType } from "@/types";
import { BookOpen, Users, ShieldCheck, GraduationCap, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function ClassesPage() {
  /** Daftar kelas */
  const [classes, setClasses] = useState<ClassItem[]>([]);
  /** Daftar guru (difilter dari /users, hanya role GURU) */
  const [teachers, setTeachers] = useState<UserType[]>([]);
  /** Indikator loading */
  const [loading, setLoading] = useState(true);
  /** State error */
  const [error, setError] = useState<string | null>(null);
  /** Role user yang sedang login (dari /auth/me) */
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  /**
   * refresh — Mengambil data kelas, users, dan role user saat ini.
   */
  function refresh() {
    setLoading(true);
    setError(null);
    logger.info("ClassesPage", "Memuat data kelas");
    Promise.all([
      // Ambil daftar kelas
      api.handleResponse(api.get<ClassItem[]>("/classes")),
      // Ambil daftar semua user (untuk opsi wali kelas)
      api.handleResponse(api.get<UserType[]>("/users")),
      // Ambil role user yang login
      api.get<{ id: string; username: string; name: string; role: string; isActive: boolean }>("/auth/me"),
    ])
      .then(([classesData, usersData, meRes]) => {
        setClasses(classesData);
        // Filter hanya user dengan role GURU untuk dropdown wali kelas
        const guruOnly = usersData.filter((u) => u.role === "GURU");
        setTeachers(guruOnly);
        if (meRes.success && meRes.data) {
          setCurrentUserRole(meRes.data.role);
        }
        logger.info("ClassesPage", "Data berhasil dimuat", {
          classesCount: classesData.length,
          teachersCount: guruOnly.length,
          role: meRes.data?.role,
        });
      })
      .catch((err) => {
        setError(err.message || "Gagal memuat data kelas");
        logger.error("ClassesPage", "Gagal memuat data kelas", { err });
      })
      .finally(() => setLoading(false));
  }

  /** Trigger refresh saat mount */
  useEffect(() => {
    refresh();
  }, []);

  /**
   * assignTeacher — Menetapkan/mengubah wali kelas untuk suatu kelas.
   * @param classId - ID kelas
   * @param teacherId - ID guru (wali kelas baru)
   */
  async function assignTeacher(classId: string, teacherId: string) {
    logger.info("ClassesPage", "Menetapkan wali kelas", { classId, teacherId });
    try {
      await api.handleResponse(
        api.patch(`/classes/${classId}/homeroom-teacher`, { teacherId })
      );
      toast.success("Wali kelas berhasil diperbarui");
      // Refresh daftar kelas agar data ter-update
      const data = await api.handleResponse(api.get<ClassItem[]>("/classes"));
      setClasses(data);
      logger.info("ClassesPage", "Wali kelas berhasil diperbarui", { classId, teacherId });
    } catch (err: any) {
      toast.error(err.message || "Gagal memperbarui wali kelas");
      logger.error("ClassesPage", "Gagal memperbarui wali kelas", { err, classId, teacherId });
    }
  }

  /** Apakah user adalah admin atau operator (berhak mengubah wali kelas)? */
  const isAdm =
    currentUserRole === "ADMINISTRATOR" || currentUserRole === "OPERATOR_SEKOLAH";

  // ── Loading State ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  // ── Error State ──────────────────────────────────────────────────
  if (error) {
    return (
      <div className="text-center py-12 text-red-500">
        <AlertCircle className="w-8 h-8 mx-auto mb-2" />
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

  /** Total jumlah kelas */
  const totalClasses = classes.length;
  /** Total jumlah siswa di semua kelas (dari _count.students) */
  const totalStudents = classes.reduce((sum, c) => sum + (c._count?.students || 0), 0);

  return (
    /* AuthGuard: hanya role tertentu yang bisa mengakses */
    <AuthGuard roles={["ADMINISTRATOR", "GURU", "KEPALA_SEKOLAH", "OPERATOR_SEKOLAH"]}>
      <div className="space-y-6">
        {/* ── Header ────────────────────────────────────────────────── */}
        <div>
          <h1 className="text-xl font-bold text-gray-900">Buku Induk (Daftar Kelas)</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Kelola data kelas dan pembagian wali kelas terdaftar untuk rekam akademis siswa.
          </p>
        </div>

        {/* ── Mini Stats ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Total kelas */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">Total Kelas</p>
              <p className="text-xl font-bold text-gray-900">{totalClasses}</p>
            </div>
          </div>
          {/* Total siswa terdaftar */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">Total Siswa Terdaftar</p>
              <p className="text-xl font-bold text-gray-900">{totalStudents}</p>
            </div>
          </div>
          {/* Total guru wali kelas */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
              <GraduationCap className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">Total Guru Wali Kelas</p>
              <p className="text-xl font-bold text-gray-900">{teachers.length}</p>
            </div>
          </div>
        </div>

        {/* ── Table ────────────────────────────────────────────────── */}
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
                /** Cari guru yang ditugaskan sebagai wali kelas ini */
                const assignedTeacher = teachers.find((u) => u.id === cls.homeroomTeacherId);
                return (
                  <tr key={cls.id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                    <td className="py-3 px-4 text-sm font-semibold text-gray-950">{cls.name}</td>
                    <td className="py-3 px-4 text-sm text-gray-500 hidden sm:table-cell">{cls.academicYear?.year ?? "-"}</td>
                    <td className="py-3 px-4 text-sm text-gray-600 font-medium">{cls._count?.students || 0} siswa</td>
                    <td className="py-3 px-4">
                      {isAdm ? (
                        /* Dropdown wali kelas — hanya untuk Admin/Operator */
                        <select
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white hover:border-gray-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                          value={cls.homeroomTeacherId || ""}
                          onChange={(e) => assignTeacher(cls.id, e.target.value)}
                        >
                          <option value="">- Belum Ditugaskan -</option>
                          {teachers.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        /* Teks biasa — untuk role viewer */
                        <span className="text-sm text-gray-700">
                          {assignedTeacher
                            ? assignedTeacher.name
                            : cls.homeroomTeacher?.name || "-"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {/* Empty state */}
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

        {/* ── Info Box — untuk non-admin ──────────────────────────────── */}
        {!isAdm && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
            <ShieldCheck className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-700 leading-relaxed">
              Anda masuk dengan hak akses peninjau/wali kelas. Perubahan guru wali kelas hanya dapat dilakukan oleh{" "}
              <strong>Administrator</strong> atau <strong>Operator Sekolah</strong>.
            </p>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
