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
import type { ClassItem, User as UserType, AiSummary } from "@/types";
import { BookOpen, Users, ShieldCheck, GraduationCap, AlertCircle, Sparkles, Loader2, X, FileText, Search } from "lucide-react";
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

  // -- Transition Summary (FR-13) --
  /** ID kelas yang sedang di-generate transition summary-nya */
  const [generatingClassId, setGeneratingClassId] = useState<string | null>(null);
  /** Hasil transition summary per kelas */
  const [transitionResults, setTransitionResults] = useState<Record<string, AiSummary[]>>({});
  /** ID kelas yang sedang menampilkan dialog hasil */
  const [showingResultClassId, setShowingResultClassId] = useState<string | null>(null);

  // -- Search Filter --
  const [searchQuery, setSearchQuery] = useState("");

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

  /** Apakah user bisa generate transition summary? (Guru, Admin, Kepala Sekolah) */
  const canTransition =
    currentUserRole === "ADMINISTRATOR" || currentUserRole === "GURU" || currentUserRole === "KEPALA_SEKOLAH";

  /**
   * handleGenerateTransition -- Generate ringkasan transisi untuk semua siswa di kelas.
   * POST /ai/classes/:id/transition-summary
   */
  async function handleGenerateTransition(classId: string) {
    setGeneratingClassId(classId);
    logger.info("ClassesPage", "Memulai generate transition summary", { classId });
    try {
      const data = await api.handleResponse(
        api.post<AiSummary[]>(`/ai/classes/${classId}/transition-summary`, {})
      );
      setTransitionResults((prev) => ({ ...prev, [classId]: data }));
      setShowingResultClassId(classId);
      toast.success(`Berhasil generate ${data.length} ringkasan transisi!`);
      logger.info("ClassesPage", "Transition summary berhasil", { classId, count: data.length });
    } catch (err: any) {
      toast.error(err.message || "Gagal generate ringkasan transisi");
      logger.error("ClassesPage", "Gagal generate transition summary", { err, classId });
    } finally {
      setGeneratingClassId(null);
    }
  }

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

        {/* -- Search Input -- */}
        <div className="relative">
          <input
            type="text"
            placeholder="Cari kelas berdasarkan nama, tahun ajaran, atau wali kelas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-4 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-medium text-gray-950 bg-white"
          />
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
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
                {canTransition && (
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Aksi</th>
                )}
              </tr>
            </thead>
            <tbody>
              {classes
                .filter((cls) => {
                  const term = searchQuery.toLowerCase().trim();
                  if (!term) return true;
                  const classNameMatch = cls.name.toLowerCase().includes(term);
                  const academicYearMatch = cls.academicYear?.year.toLowerCase().includes(term) ?? false;
                  const assignedTeacher = teachers.find((u) => u.id === cls.homeroomTeacherId);
                  const teacherMatch = assignedTeacher?.name.toLowerCase().includes(term) ?? cls.homeroomTeacher?.name.toLowerCase().includes(term) ?? false;
                  return classNameMatch || academicYearMatch || teacherMatch;
                })
                .map((cls) => {
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
                    {/* Kolom Aksi -- Tombol Transition Summary (FR-13) */}
                    {canTransition && (
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleGenerateTransition(cls.id)}
                            disabled={generatingClassId === cls.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Generate ringkasan transisi siswa kelas ini"
                          >
                            {generatingClassId === cls.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Sparkles className="w-3 h-3" />
                            )}
                            {generatingClassId === cls.id ? "Proses..." : "Transisi"}
                          </button>
                          {/* Tombol lihat hasil jika sudah pernah generate */}
                          {transitionResults[cls.id] && transitionResults[cls.id].length > 0 && (
                            <button
                              onClick={() => setShowingResultClassId(cls.id)}
                              className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-gray-500 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                              title="Lihat hasil ringkasan transisi"
                            >
                              <FileText className="w-3 h-3" />
                              Lihat
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {/* Empty state */}
              {classes.length === 0 && (
                <tr>
                  <td colSpan={canTransition ? 5 : 4} className="py-12 text-center text-sm text-gray-400">
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
        {/* -- Transition Summary Result Dialog (FR-13) -- */}
        {showingResultClassId && transitionResults[showingResultClassId] && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowingResultClassId(null)}>
            <div
              className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Dialog Header */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-500" />
                    Ringkasan Transisi Siswa
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Kelas: {classes.find((c) => c.id === showingResultClassId)?.name || "-"}
                    {" "}&mdash;{" "}
                    {transitionResults[showingResultClassId].length} ringkasan
                  </p>
                </div>
                <button
                  onClick={() => setShowingResultClassId(null)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              {/* Dialog Body */}
              <div className="overflow-y-auto p-6 space-y-4">
                {transitionResults[showingResultClassId].map((summary, idx) => (
                  <div key={summary.id || idx} className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                        Ringkasan #{idx + 1}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        v{summary.version} {summary.isFinal ? "(Final)" : "(Draft)"}
                      </span>
                    </div>
                    <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {summary.content}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
