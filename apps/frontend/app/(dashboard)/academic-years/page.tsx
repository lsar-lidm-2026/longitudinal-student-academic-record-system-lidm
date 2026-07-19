"use client";

/**
 * Cara kerja file (How this file works):
 * =======================================
 * Halaman ini mengelola tahun ajaran (Academic Years). Fitur:
 * - Melihat daftar semua tahun ajaran dengan statusnya.
 * - Menambah tahun ajaran baru via form.
 * - Mengaktifkan tahun ajaran (Set Aktif).
 * - Mengarsipkan tahun ajaran.
 *
 * Alur lengkap:
 * 1. useEffect memanggil load() saat mount — GET /academic-years.
 * 2. Data ditampilkan dalam daftar dengan ikon status:
 *    - Hijau (CheckCircle) = Aktif Sekarang
 *    - Abu-abu (Archive) = Diarsipkan
 *    - Biru (Clock) = Tersedia
 * 3. Form di samping kanan menerima input tahun (format: 2025/2026),
 *    lalu POST /academic-years untuk membuat baru.
 * 4. Setiap item tahun ajaran memiliki tombol:
 *    - "Set Aktif" (hanya untuk yang tidak aktif dan tidak diarsip)
 *    - "Arsipkan" (untuk yang belum diarsip)
 * 5. Hanya role ADMINISTRATOR yang bisa mengakses halaman ini via AuthGuard.
 */

import { useEffect, useState, FormEvent } from "react";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { logger } from "@/lib/logger";
import { Calendar, Plus, Archive, CheckCircle, Clock, Trash2 } from "lucide-react";
import type { AcademicYear } from "@/types";

export default function AcademicYearsPage() {
  /** Daftar tahun ajaran */
  const [years, setYears] = useState<AcademicYear[]>([]);
  /** Indikator loading */
  const [loading, setLoading] = useState(true);
  /** State error */
  const [error, setError] = useState<string | null>(null);
  /** Nilai input form tahun ajaran baru */
  const [newYear, setNewYear] = useState("");
  /** Indikator sedang membuat tahun ajaran baru */
  const [creating, setCreating] = useState(false);

  /**
   * load — Mengambil daftar tahun ajaran dari API.
   */
  function load() {
    setLoading(true);
    setError(null);
    logger.info("AcademicYearsPage", "Memuat daftar tahun ajaran");
    api.handleResponse(api.get<AcademicYear[]>("/academic-years"))
      .then((data) => {
        setYears(data);
        logger.info("AcademicYearsPage", "Tahun ajaran berhasil dimuat", { count: data.length });
      })
      .catch((err) => {
        setError(err.message || "Gagal memuat tahun ajaran");
        logger.error("AcademicYearsPage", "Gagal memuat tahun ajaran", { err });
      })
      .finally(() => setLoading(false));
  }

  /** Trigger load saat mount */
  useEffect(() => { load(); }, []);

  /**
   * create — Membuat tahun ajaran baru via API POST.
   * @param e - Form submit event
   */
  async function create(e: FormEvent) {
    e.preventDefault();
    if (creating) return;

    // Validasi format tahun ajaran: harus YYYY/YYYY
    if (!/^\d{4}\/\d{4}$/.test(newYear)) {
      toast.error("Format tahun ajaran harus YYYY/YYYY (contoh: 2025/2026)");
      return;
    }

    // Validasi tahun kedua = tahun pertama + 1
    const [year1, year2] = newYear.split("/").map(Number);
    if (year2 !== year1 + 1) {
      toast.error("Tahun kedua harus tahun pertama + 1 (contoh: 2025/2026)");
      return;
    }

    setCreating(true);
    logger.info("AcademicYearsPage", "Membuat tahun ajaran baru", { year: newYear });
    try {
      const res = await api.post("/academic-years", { year: newYear });
      if (res.success) {
        setNewYear("");
        toast.success("Tahun ajaran berhasil ditambahkan");
        load(); // Refresh daftar
      } else {
        toast.error(res.error?.message || "Gagal membuat tahun ajaran");
        logger.error("AcademicYearsPage", "Gagal membuat tahun ajaran (res)", { error: res.error });
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal membuat tahun ajaran");
      logger.error("AcademicYearsPage", "Gagal membuat tahun ajaran", { err });
    } finally {
      setCreating(false);
    }
  }

  /**
   * activate — Mengaktifkan tahun ajaran (set isActive = true).
   * @param id - ID AcademicYear
   */
  async function activate(id: string) {
    logger.info("AcademicYearsPage", "Mengaktifkan tahun ajaran", { id });
    try {
      await api.patch(`/academic-years/${id}/activate`);
      toast.success("Tahun ajaran diaktifkan");
      load(); // Refresh daftar
    } catch (err: any) {
      toast.error(err.message || "Gagal mengaktifkan tahun ajaran");
      logger.error("AcademicYearsPage", "Gagal mengaktifkan tahun ajaran", { err });
    }
  }

  /**
   * archive — Mengarsipkan tahun ajaran (set isArchived = true).
   * @param id - ID AcademicYear
   */
  async function archive(id: string) {
    logger.info("AcademicYearsPage", "Mengarsipkan tahun ajaran", { id });
    try {
      await api.patch(`/academic-years/${id}/archive`);
      toast.success("Tahun ajaran diarsipkan");
      load(); // Refresh daftar
    } catch (err: any) {
      toast.error(err.message || "Gagal mengarsipkan tahun ajaran");
      logger.error("AcademicYearsPage", "Gagal mengarsipkan tahun ajaran", { err });
    }
  }

  /**
   * handleDeleteYear — Menghapus tahun ajaran (hanya yang non-active, non-archived).
   * @param yearId - ID AcademicYear
   * @param year - Tahun ajaran (untuk konfirmasi)
   */
  async function handleDeleteYear(yearId: string, year: string) {
    if (!confirm(`Hapus tahun ajaran ${year}? Data terkait akan ikut terhapus.`)) return;
    try {
      await api.handleResponse(api.delete(`/academic-years/${yearId}`));
      toast.success(`Tahun ajaran ${year} berhasil dihapus`);
      load();
    } catch (err: any) {
      toast.error(err.message || "Gagal menghapus tahun ajaran");
    }
  }

  // ── Loading State ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  // ── Error State ──────────────────────────────────────────────────
  if (error) {
    return (
      <div className="text-center py-12 text-red-500">
        <p>{error}</p>
        <button
          onClick={load}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  return (
    /* AuthGuard: hanya ADMINISTRATOR yang bisa mengakses halaman ini */
    <AuthGuard roles={["ADMINISTRATOR"]}>
      <div className="space-y-6 max-w-4xl mx-auto">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-500" />
              Tahun Ajaran
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Kelola periode tahun ajaran aktif dan pengarsipan data lama.
            </p>
          </div>
        </div>

        {/* Grid: daftar (kiri) + form create (kanan) */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-6 items-start">

          {/* ── Main List ──────────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
              <h3 className="text-sm font-semibold text-gray-900">Daftar Tahun Ajaran</h3>
            </div>

            <div className="divide-y divide-gray-50">
              {/* Iterasi setiap tahun ajaran — tampilkan ikon status + tombol aksi */}
              {years.map((year) => (
                <div key={year.id} className="flex items-center justify-between p-5 hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-center gap-4">
                    {/* Ikon status — berbeda warna sesuai state */}
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      year.isActive ? "bg-emerald-50" : year.isArchived ? "bg-gray-100" : "bg-blue-50"
                    }`}>
                      {year.isActive ? (
                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                      ) : year.isArchived ? (
                        <Archive className="w-5 h-5 text-gray-400" />
                      ) : (
                        <Clock className="w-5 h-5 text-blue-500" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{year.year}</p>
                      {/* Badge status */}
                      <div className="flex gap-2 mt-1">
                        {year.isActive && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                            Aktif Sekarang
                          </span>
                        )}
                        {year.isArchived && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                            Diarsipkan
                          </span>
                        )}
                        {!year.isActive && !year.isArchived && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                            Tersedia
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Tombol aksi per item */}
                  <div className="flex items-center gap-2">
                    {/* Tombol Set Aktif — hanya untuk yang Tersedia */}
                    {!year.isActive && !year.isArchived && (
                      <button
                        onClick={() => activate(year.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-emerald-200 text-emerald-700 rounded-lg hover:bg-emerald-50 transition-colors"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Set Aktif
                      </button>
                    )}
                    {/* Tombol Arsipkan — untuk yang belum diarsip */}
                    {!year.isArchived && (
                      <button
                        onClick={() => archive(year.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 hover:text-red-600 transition-colors"
                      >
                        <Archive className="w-3.5 h-3.5" /> Arsipkan
                      </button>
                    )}
                    {/* Tombol Hapus — hanya untuk yang tidak aktif dan tidak diarsip */}
                    {!year.isActive && !year.isArchived && (
                      <button
                        onClick={() => handleDeleteYear(year.id, year.year)}
                        className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                        title="Hapus tahun ajaran"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {/* Empty state */}
              {years.length === 0 && (
                <div className="text-center py-12">
                  <Calendar className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 font-medium">Belum ada tahun ajaran</p>
                  <p className="text-xs text-gray-400 mt-1">Tambahkan tahun ajaran pertama Anda pada form di samping.</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Form Create ──────────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-blue-100 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-500" />
              Tambah Periode
            </h3>
            <form onSubmit={create} className="space-y-4">
              {/* Input tahun ajaran (format: 2025/2026) */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Format (Tahun/Tahun)</label>
                <input
                  type="text"
                  placeholder="Contoh: 2025/2026"
                  value={newYear}
                  onChange={(e) => setNewYear(e.target.value)}
                  pattern="^\d{4}/\d{4}$"
                  title="Format: YYYY/YYYY (contoh: 2025/2026)"
                  required
                  className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-gray-300"
                />
              </div>
              {/* Tombol submit */}
              <button
                type="submit"
                disabled={creating}
                className="w-full inline-flex items-center justify-center gap-2 h-10 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {creating ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                ) : (
                  "Tambahkan"
                )}
              </button>
            </form>

            {/* Info box — menjelaskan bahwa perlu Set Aktif manual */}
            <div className="mt-5 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-[11px] text-blue-800 leading-relaxed">
                <strong>Info:</strong> Menambahkan periode baru tidak akan langsung mengaktifkannya. Anda harus menekan tombol "Set Aktif" pada periode tersebut.
              </p>
            </div>
          </div>

        </div>
      </div>
    </AuthGuard>
  );
}
