/**
 * Dashboard Page — LSAR Frontend
 * ================================
 * Cara Kerja:
 * 1. Halaman ini adalah Client Component yang menampilkan ringkasan dashboard.
 * 2. useEffect memanggil refresh() saat mount untuk fetch data dari /dashboard/summary.
 * 3. refresh() menggunakan api.handleResponse() untuk memproses response.
 * 4. Data ditampilkan dalam beberapa section:
 *    - Welcome Banner (sapaan + info tahun ajaran aktif)
 *    - Statistik Utama (total siswa, kelas, tahun, draft AI)
 *    - Akses Cepat (link ke halaman penting)
 *    - Kelas yang Diampu (daftar kelas dengan jumlah siswa)
 *    - Tugas & Pengingat (rekomendasi aksi guru)
 *    - Aktivitas Terakhir (riwayat sistem)
 *    - AI Insight Banner (promosi fitur AI)
 *
 * Alur:
 * - Komponen mount → useEffect → refresh() → GET /dashboard/summary
 * - Loading state: spinner di tengah
 * - Error state: pesan merah + tombol "Coba Lagi"
 * - Empty state: pesan "Tidak ada data dashboard"
 * - Sukses: render semua section dengan data dari API
 *
 * Sub Components:
 * - StatCard: menampilkan metrik dengan ikon, label, dan nilai.
 * - QuickAccessCard: kartu link cepat ke halaman tertentu.
 * - ActivityItem: item aktivitas dengan ikon, teks, waktu, dan tag.
 *
 * Logger:
 * - Log info saat fetch data dashboard.
 * - Log error jika fetch gagal.
 * - Log warn jika data kosong.
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  TrendingUp,
  CalendarCheck,
  Sparkles,
  FileInput,
  Bot,
  BookOpen,
  Printer,
  Clock,
  ArrowRight,
  AlertCircle,
  Check,
  Loader2,
  PlusCircle,
  MinusCircle,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { formatRelativeTime } from "@/lib/utils";
import type { DashboardSummary, ActivityItem } from "@/types";
import { logger } from "@/lib/logger";

/**
 * DashboardPage — Halaman utama setelah login.
 * Menampilkan ringkasan data akademik dan akses cepat.
 *
 * @returns JSX halaman dashboard dengan beberapa section.
 */
export default function DashboardPage() {
  /** Data dashboard dari API — null saat loading */
  const [data, setData] = useState<DashboardSummary | null>(null);
  /** Indikator loading */
  const [loading, setLoading] = useState(true);
  /** Pesan error — null jika tidak ada error */
  const [error, setError] = useState<string | null>(null);
  /** Tugas & pengingat yang dibangun dari data summary */
  const [tasks, setTasks] = useState<Array<{ text: string; priority: "high" | "medium" }>>([]);
  /** ID kelas yang sedang diperluas (expand) — null berarti tidak ada */
  const [expandedClass, setExpandedClass] = useState<string | null>(null);
  /** Daftar siswa per kelas — keyed by classId */
  const [classStudents, setClassStudents] = useState<Record<string, Array<{ id: string; name: string; nis?: string }>>>({});

  /**
   * refresh — Fetch data dashboard dari API.
   * Menggunakan api.handleResponse() untuk unwrap response otomatis.
   */
  function refresh() {
    logger.info("DashboardPage", "Fetching dashboard summary");
    setLoading(true);
    setError(null);
    api.handleResponse(api.get<DashboardSummary>("/dashboard/summary"))
      .then((responseData) => {
        setData(responseData);
        // Bangun daftar tugas & pengingat dari data summary
        const newTasks: Array<{ text: string; priority: "high" | "medium" }> = [];
        if (responseData.pendingAiDrafts && responseData.pendingAiDrafts > 0) {
          newTasks.push({ text: `${responseData.pendingAiDrafts} draft AI perlu ditinjau`, priority: "high" });
        }
        if (newTasks.length === 0) {
          newTasks.push({ text: "Lengkapi data semester aktif", priority: "medium" });
        }
        setTasks(newTasks);
        logger.info("DashboardPage", "Dashboard data loaded", {
          totalStudents: responseData.totalStudents,
          totalClasses: responseData.totalClasses,
          activeYear: responseData.activeYear,
        });
      })
      .catch((err) => {
        const errorMsg = err.message || "Gagal memuat data dashboard";
        logger.error("DashboardPage", "Failed to load dashboard data", { error: errorMsg });
        setError(errorMsg);
      })
      .finally(() => setLoading(false));
  }

  /** Data aktivitas dari API /activity — empty array saat loading atau error */
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  /** Indikator loading aktivitas */
  const [activitiesLoading, setActivitiesLoading] = useState(true);

  /**
   * fetchActivities — Fetch data aktivitas terbaru dari /activity.
   * Jika gagal, hanya log error dan biarkan activities sebagai array kosong.
   */
  function fetchActivities() {
    logger.info("DashboardPage", "Fetching recent activities");
    setActivitiesLoading(true);
    api.handleResponse(api.get<ActivityItem[]>("/dashboard/activity"))
      .then((responseData) => {
        setActivities(responseData);
        logger.info("DashboardPage", "Activities loaded", { count: responseData.length });
      })
      .catch((err) => {
        logger.error("DashboardPage", "Failed to load activities", { error: err.message });
        // Silent fail — tampilkan section kosong
        setActivities([]);
      })
      .finally(() => setActivitiesLoading(false));
  }

  /**
   * toggleClassStudents — Expand/collapse daftar siswa dalam satu kelas.
   * Jika kelas sudah di-expand, collapse. Jika belum, fetch daftar siswa dari API.
   * @param classId - ID kelas yang diklik
   */
  async function toggleClassStudents(classId: string) {
    if (expandedClass === classId) {
      setExpandedClass(null);
      return;
    }
    setExpandedClass(classId);
    if (!classStudents[classId]) {
      try {
        const data = await api.handleResponse(api.get<Array<{ id: string; name: string; nis?: string }>>(`/classes/${classId}/students`));
        setClassStudents(prev => ({ ...prev, [classId]: data }));
      } catch (err: any) {
        toast.error(err.message || "Gagal memuat daftar siswa");
      }
    }
  }

  /* Fetch data saat komponen mount — sekali saja (dependency []) */
  useEffect(() => {
    refresh();
    fetchActivities();
  }, []);

  /* ── Loading State ──────────────────────────────────────── */
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        {/* Spinner animasi */}
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  /* ── Error State ────────────────────────────────────────── */
  if (error) {
    return (
      <div className="text-center py-12 text-red-500">
        <p>{error}</p>
        {/* Tombol retry — panggil refresh() lagi */}
        <button
          onClick={refresh}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  /* ── Empty State ────────────────────────────────────────── */
  if (!data) {
    logger.warn("DashboardPage", "No dashboard data available");
    return (
      <div className="text-center py-12 text-gray-500">
        Tidak ada data dashboard
      </div>
    );
  }

  /* ── Render Dashboard ───────────────────────────────────── */
  return (
    <div className="space-y-6">
      {/* ── Welcome Banner ──────────────────────────────────── */}
      {/* Gradient banner biru dengan teks sambutan dan tombol aksi */}
      <div className="relative bg-gradient-to-r from-blue-600 via-blue-500 to-blue-400 rounded-2xl p-6 md:p-8 text-white overflow-hidden shadow-sm">
        {/* Elemen dekoratif bundar di pojok */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/3 translate-x-1/3" />
        <div className="absolute bottom-0 right-20 w-40 h-40 bg-white/5 rounded-full translate-y-1/2" />
        <div className="relative">
          {/* Badge tahun ajaran aktif — hanya tampil jika ada data.activeYear */}
          {data.activeYear && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/15 rounded-full text-xs font-medium mb-3">
              <Sparkles className="w-3 h-3" />
              TAHUN AJARAN {data.activeYear}
            </span>
          )}
          <h1 className="text-2xl md:text-3xl font-bold">Selamat Datang Kembali! 👋</h1>
          <p className="text-blue-100 mt-2 text-sm max-w-xl leading-relaxed">
            Platform LSAR siap membantu Anda mengelola data akademik siswa.
            {/* Info draft AI yang perlu review — conditional */}
            {data.pendingAiDrafts && data.pendingAiDrafts > 0 && (
              <> Ada <strong>{data.pendingAiDrafts} draft AI</strong> yang perlu ditinjau.</>
            )}
          </p>
          {/* Tombol aksi banner */}
          <div className="flex gap-3 mt-5">
            <Link
              href="/ml"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white text-blue-600 text-sm font-semibold rounded-lg hover:bg-blue-50 transition-colors shadow-sm"
            >
              Lihat Review AI
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/settings"
              className="inline-flex items-center gap-2 px-4 py-2 border border-white/30 text-white text-sm font-semibold rounded-lg hover:bg-white/10 transition-colors"
            >
              Pengaturan
            </Link>
          </div>
        </div>
      </div>

      {/* ── Statistik Utama ──────────────────────────────────── */}
      <div>
        {/* Header section dengan label "Real-time" */}
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-base font-semibold text-gray-900">Statistik Utama</h2>
          <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-medium rounded-full uppercase tracking-wider">
            Real-time
          </span>
        </div>
        {/* Grid 2 kolom mobile, 4 kolom desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={Users}
            label="Total Siswa"
            value={data.totalStudents}
            iconBg="bg-blue-50"
            iconColor="text-blue-500"
          />
          {/* Total Kelas — hanya tampil jika ada data dari API */}
          {data.totalClasses !== undefined && (
            <StatCard
              icon={TrendingUp}
              label="Total Kelas"
              value={data.totalClasses}
              iconBg="bg-green-50"
              iconColor="text-green-500"
            />
          )}
          <StatCard
            icon={CalendarCheck}
            label="Tahun Aktif"
            value={data.activeYear || "-"}
            iconBg="bg-amber-50"
            iconColor="text-amber-500"
            isText
          />
          {/* Draft AI — kartu dengan status badge merah/hijau */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">Draft AI</span>
              <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full ${
                (data?.pendingAiDrafts || 0) > 0
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-green-100 text-green-700'
              }`}>
                {(data?.pendingAiDrafts || 0) > 0 ? 'Perlu Review' : 'Selesai'}
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900 mt-1">{data?.pendingAiDrafts || 0}</p>
            <p className="text-xs text-gray-400 mt-0.5">Draft AI belum difinalisasi</p>
          </div>
        </div>
      </div>

      {/* ── Akses Cepat ──────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">Akses Cepat</h2>
        </div>
        {/* Grid 2 kolom mobile, 4 kolom desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <QuickAccessCard
            href="/students"
            icon={FileInput}
            title="Data Siswa"
            description="Kelola biodata dan data siswa."
            primary
          />
          <QuickAccessCard
            href="/ml"
            icon={Bot}
            title="Analisis AI"
            description="Review perkembangan siswa."
          />
          <QuickAccessCard
            href="/classes"
            icon={Printer}
            title="Manajemen Kelas"
            description="Atur data kelas dan rombongan belajar."
          />
        </div>
      </div>

      {/* ── Grid Bawah: 2/3 kiri + 1/3 kanan ────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Kolom Kiri (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Kelas yang Diampu — hanya tampil jika ada data managedClasses */}
          {data.managedClasses && data.managedClasses.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-500" />
                Kelas yang Diampu
              </h3>
              <div className="space-y-2">
                {/* Iterasi daftar kelas yang diampu guru — expandable */}
                {data.managedClasses.map((cls) => (
                  <div key={cls.id}>
                    {/* Header kelas — klik untuk expand/collapse */}
                    <div
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                      onClick={() => toggleClassStudents(cls.id)}
                    >
                      <div className="flex items-center gap-2">
                        {expandedClass === cls.id ? (
                          <MinusCircle className="w-4 h-4 text-blue-500" />
                        ) : (
                          <PlusCircle className="w-4 h-4 text-gray-400" />
                        )}
                        <span className="text-sm font-medium text-gray-900">{cls.name}</span>
                      </div>
                      <span className="text-xs text-gray-500 font-medium">
                        {cls._count?.students || 0} siswa
                      </span>
                    </div>
                    {/* Expanded student list — tampil hanya jika kelas ini di-expand */}
                    {expandedClass === cls.id && (
                      <div className="mt-1 ml-6 space-y-1">
                        {!classStudents[cls.id] ? (
                          <div className="flex items-center gap-2 p-2">
                            <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                            <span className="text-xs text-gray-400">Memuat daftar siswa...</span>
                          </div>
                        ) : classStudents[cls.id].length === 0 ? (
                          <p className="text-xs text-gray-400 p-2">Belum ada siswa di kelas ini</p>
                        ) : (
                          <>
                            {classStudents[cls.id].slice(0, 10).map((student) => (
                              <Link
                                key={student.id}
                                href={`/students/${student.id}`}
                                className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors group"
                              >
                                <ChevronRight className="w-3 h-3 text-gray-300 group-hover:text-gray-500 transition-colors" />
                                <span className="text-sm text-gray-700 group-hover:text-blue-600 transition-colors">
                                  {student.name}
                                </span>
                                {student.nis && (
                                  <span className="text-[10px] text-gray-400">({student.nis})</span>
                                )}
                              </Link>
                            ))}
                            {/* Link "Lihat semua" jika siswa > 10 */}
                            {classStudents[cls.id].length > 10 && (
                              <Link
                                href={`/classes/${cls.id}`}
                                className="flex items-center gap-2 p-2 text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
                              >
                                <ChevronDown className="w-3 h-3" />
                                Lihat semua {classStudents[cls.id].length} siswa
                              </Link>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tugas & Pengingat */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-500" />
              Tugas & Pengingat
            </h3>
            <div className="space-y-2">
              {tasks.length === 0 ? (
                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                  <Check className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-green-700">Semua data sudah lengkap</span>
                </div>
              ) : (
                tasks.map((task, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${task.priority === "high" ? "bg-red-500" : "bg-green-500"}`} />
                      <span className="text-sm text-gray-700">{task.text}</span>
                    </div>
                    <span className={`text-xs font-medium ${task.priority === "high" ? "text-red-400" : "text-gray-400"}`}>
                      {task.priority === "high" ? "Prioritas" : "Opsional"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Kolom Kanan (1/3) */}
        <div className="space-y-6">
          {/* Aktivitas Terakhir */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Aktivitas Terakhir</h3>
            <p className="text-xs text-gray-400 mb-3">Riwayat pembaruan data terbaru</p>
            {/* Loading state: spinner kecil */}
            {activitiesLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
              </div>
            ) : activities.length === 0 ? (
              /* Empty state: tidak ada aktivitas */
              <div className="text-center py-6">
                <p className="text-xs text-gray-400">Belum ada aktivitas</p>
                <p className="text-[11px] text-gray-300 mt-1">Mulai dengan menginput data siswa atau nilai semester.</p>
              </div>
            ) : (
              /* Daftar aktivitas dari API */
              <div className="space-y-3">
                {activities.map((activity) => (
                  <ActivityItem
                    key={activity.id}
                    text={activity.description}
                    time={formatRelativeTime(activity.timestamp)}
                    tag={getActionTag(activity.action)}
                    tagColor={getActionTagColor(activity.action)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Ringkasan Aktivitas ──────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-500" />
          Ringkasan Aktivitas
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-wider">Total Siswa</p>
            <p className="text-xl font-bold text-blue-700 mt-0.5">{data.totalStudents || 0}</p>
          </div>
          <div className="p-3 bg-purple-50 rounded-lg">
            <p className="text-[10px] font-semibold text-purple-500 uppercase tracking-wider">Draft AI</p>
            <p className="text-xl font-bold text-purple-700 mt-0.5">
              {data.pendingAiDrafts !== undefined ? data.pendingAiDrafts : 0}
            </p>
          </div>
        </div>
        <div className="mt-3">
          <Link
            href="/ml"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            Lihat detail analisis AI →
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════ */
/*  SUB COMPONENTS                                               */
/* ════════════════════════════════════════════════════════════════ */

/**
 * StatCard — Kartu statistik dengan ikon, label, dan nilai.
 *
 * @param icon — Komponen ikon (lucide-react).
 * @param label — Label teks di atas nilai (contoh: "Total Siswa").
 * @param value — Nilai numerik atau teks (contoh: 150, "2024/2025").
 * @param iconBg — Class Tailwind untuk background ikon.
 * @param iconColor — Class Tailwind untuk warna ikon.
 * @param subtitle — Teks tambahan di bawah nilai (opsional).
 * @param isText — Jika true, gunakan font lebih kecil untuk nilai teks.
 */
function StatCard({
  icon: Icon,
  label,
  value,
  iconBg,
  iconColor,
  subtitle,
  isText,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  iconBg: string;
  iconColor: string;
  subtitle?: string;
  isText?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-sm transition-shadow">
      {/* Ikon dengan background berwarna */}
      <div className="flex items-center justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center`}>
          <Icon className={`w-[18px] h-[18px] ${iconColor}`} />
        </div>
      </div>
      {/* Label (uppercase, tracking-wider) */}
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
      {/* Nilai — large atau sedang tergantung isText */}
      <p className={`font-bold text-gray-900 mt-0.5 ${isText ? "text-lg" : "text-2xl"}`}>
        {value}
      </p>
      {/* Subtitle opsional — informasi tambahan */}
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  );
}

/**
 * QuickAccessCard — Kartu link cepat ke halaman lain.
 *
 * @param href — Route tujuan (Link href).
 * @param icon — Komponen ikon (lucide-react).
 * @param title — Judul kartu.
 * @param description — Deskripsi singkat.
 * @param primary — Jika true, tampilkan gaya biru (highlight).
 */
function QuickAccessCard({
  href,
  icon: Icon,
  title,
  description,
  primary,
}: {
  href: string;
  icon: React.ElementType;
  title: string;
  description: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      /* Gaya berbeda untuk primary (blue) vs default (white) */
      className={`rounded-xl p-4 transition-all hover:shadow-md group border ${
        primary
          ? "bg-blue-50/50 border-blue-100 hover:border-blue-200"
          : "bg-white border-gray-100 hover:border-gray-200"
      }`}
    >
      {/* Ikon — blue solid untuk primary, gray untuk default */}
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${
          primary ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-500 group-hover:bg-gray-200"
        }`}
      >
        <Icon className="w-[18px] h-[18px]" />
      </div>
      {/* Judul */}
      <h3 className={`text-sm font-semibold ${primary ? "text-blue-700" : "text-gray-900"}`}>
        {title}
      </h3>
      {/* Deskripsi */}
      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{description}</p>
    </Link>
  );
}

/**
 * getActionTag — Mapping action code ke label tag yang user-friendly.
 *
 * @param action — Kode aksi dari API (e.g. "AI_DRAFT_CREATED", "TEACHER_CHANGED").
 * @returns Label tag pendek untuk display.
 */
function getActionTag(action: string): string {
  const map: Record<string, string> = {
    AI_DRAFT_CREATED: "AI",
    TEACHER_CHANGED: "KELAS",
  };
  return map[action] || "SISTEM";
}

/**
 * getActionTagColor — Mapping action code ke warna tag.
 *
 * @param action — Kode aksi dari API.
 * @returns Nama warna: "blue" | "green" | "red" | "amber".
 */
function getActionTagColor(action: string): string {
  const map: Record<string, string> = {
    AI_DRAFT_CREATED: "blue",
    TEACHER_CHANGED: "amber",
  };
  return map[action] || "green";
}

/**
 * ActivityItem — Item aktivitas dalam daftar riwayat.
 *
 * @param text — Teks aktivitas.
 * @param time — Waktu relatif (contoh: "Baru saja", "2 jam lalu").
 * @param tag — Label tag (contoh: "SISTEM", "INFO").
 * @param tagColor — Warna tag: "blue" | "green" | "red" | "amber".
 */
function ActivityItem({
  text,
  time,
  tag,
  tagColor,
}: {
  text: string;
  time: string;
  tag: string;
  tagColor: string;
}) {
  /* Mapping warna tag ke class Tailwind */
  const colors: Record<string, string> = {
    blue: "bg-blue-100 text-blue-600",
    green: "bg-green-100 text-green-600",
    red: "bg-red-100 text-red-600",
    amber: "bg-amber-100 text-amber-600",
  };
  return (
    <div className="flex items-start gap-3">
      {/* Ikon lingkaran dengan AlertCircle */}
      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
        <AlertCircle className="w-3.5 h-3.5 text-gray-400" />
      </div>
      <div className="flex-1 min-w-0">
        {/* Teks aktivitas */}
        <p className="text-sm text-gray-700">{text}</p>
        {/* Waktu + Tag */}
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-gray-400">{time}</span>
          {/* Tag dengan warna dinamis, fallback ke biru */}
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${colors[tagColor] || colors.blue}`}>
            {tag}
          </span>
        </div>
      </div>
    </div>
  );
}
