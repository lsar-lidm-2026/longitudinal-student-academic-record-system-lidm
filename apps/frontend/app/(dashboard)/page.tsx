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
} from "lucide-react";
import { api } from "@/lib/api";
import type { DashboardSummary } from "@/types";

export default function DashboardPage() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    setLoading(true);
    setError(null);
    api.handleResponse(api.get<DashboardSummary>("/dashboard/summary"))
      .then((data) => setData(data))
      .catch((err) => setError(err.message || "Gagal memuat data dashboard"))
      .finally(() => setLoading(false));
  }

  useEffect(() => { refresh(); }, []);

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

  if (!data) {
    return (
      <div className="text-center py-12 text-gray-500">
        Tidak ada data dashboard
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="relative bg-gradient-to-r from-blue-600 via-blue-500 to-blue-400 rounded-2xl p-6 md:p-8 text-white overflow-hidden shadow-sm">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/3 translate-x-1/3" />
        <div className="absolute bottom-0 right-20 w-40 h-40 bg-white/5 rounded-full translate-y-1/2" />
        <div className="relative">
          {data.activeYear && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/15 rounded-full text-xs font-medium mb-3">
              <Sparkles className="w-3 h-3" />
              TAHUN AJARAN {data.activeYear}
            </span>
          )}
          <h1 className="text-2xl md:text-3xl font-bold">Selamat Datang Kembali! 👋</h1>
          <p className="text-blue-100 mt-2 text-sm max-w-xl leading-relaxed">
            Platform LSAR siap membantu Anda mengelola data akademik siswa.
            {data.pendingAiDrafts && data.pendingAiDrafts > 0 && (
              <> Ada <strong>{data.pendingAiDrafts} draft AI</strong> yang perlu ditinjau.</>
            )}
          </p>
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

      {/* Stats */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-base font-semibold text-gray-900">Statistik Utama</h2>
          <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-medium rounded-full uppercase tracking-wider">
            Real-time
          </span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={Users}
            label="Total Siswa"
            value={data.totalStudents}
            iconBg="bg-blue-50"
            iconColor="text-blue-500"
          />
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
          {data.pendingAiDrafts !== undefined && (
            <StatCard
              icon={Sparkles}
              label="Review AI"
              value={data.pendingAiDrafts}
              iconBg="bg-purple-50"
              iconColor="text-purple-500"
              subtitle="Perlu tinjauan"
            />
          )}
        </div>
      </div>

      {/* Quick Access */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">Akses Cepat</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <QuickAccessCard
            href="/students"
            icon={FileInput}
            title="Input Nilai Semester"
            description="Masukkan nilai akademik siswa."
            primary
          />
          <QuickAccessCard
            href="/ml"
            icon={Bot}
            title="Analisis AI"
            description="Review perkembangan siswa."
          />
          <QuickAccessCard
            href="/students"
            icon={Users}
            title="Data Master Siswa"
            description="Kelola biodata siswa."
          />
          <QuickAccessCard
            href="/classes"
            icon={Printer}
            title="Cetak Buku Induk"
            description="Generate laporan resmi."
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tugas & Pengingat */}
        <div className="lg:col-span-2 space-y-6">
          {/* Managed Classes */}
          {data.managedClasses && data.managedClasses.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-500" />
                Kelas yang Diampu
              </h3>
              <div className="space-y-2">
                {data.managedClasses.map((cls) => (
                  <div
                    key={cls.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <span className="text-sm font-medium text-gray-900">{cls.name}</span>
                    <span className="text-xs text-gray-500 font-medium">
                      {cls._count?.students || 0} siswa
                    </span>
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
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-sm text-gray-700">Lengkapi data semester aktif</span>
                </div>
                <span className="text-xs text-gray-400 font-medium">Prioritas</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-sm text-gray-700">Review draft AI terbaru</span>
                </div>
                <span className="text-xs text-gray-400 font-medium">Opsional</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Aktivitas Terakhir */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Aktivitas Terakhir</h3>
            <p className="text-xs text-gray-400 mb-3">Riwayat pembaruan data terbaru</p>
            <div className="space-y-3">
              <ActivityItem text="Sistem siap digunakan" time="Baru saja" tag="SISTEM" tagColor="blue" />
              <ActivityItem text="Data tahun ajaran diperbarui" time="Otomatis" tag="INFO" tagColor="green" />
            </div>
          </div>
        </div>
      </div>

      {/* AI Insight Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-500 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Insight AI</h3>
            <p className="text-xs text-blue-100 mt-0.5 leading-relaxed">
              Gunakan AI untuk menganalisis perkembangan akademik siswa dan mendapatkan rekomendasi.
            </p>
          </div>
        </div>
        <Link
          href="/ml"
          className="shrink-0 px-4 py-2 bg-white text-blue-600 text-sm font-semibold rounded-lg hover:bg-blue-50 transition-colors shadow-sm"
        >
          Buka Analisis
        </Link>
      </div>
    </div>
  );
}

/* ── Sub Components ──────────────────────────────────────────── */

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
      <div className="flex items-center justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center`}>
          <Icon className={`w-[18px] h-[18px] ${iconColor}`} />
        </div>
      </div>
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
      <p className={`font-bold text-gray-900 mt-0.5 ${isText ? "text-lg" : "text-2xl"}`}>
        {value}
      </p>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  );
}

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
      className={`rounded-xl p-4 transition-all hover:shadow-md group border ${
        primary
          ? "bg-blue-50/50 border-blue-100 hover:border-blue-200"
          : "bg-white border-gray-100 hover:border-gray-200"
      }`}
    >
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${
          primary ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-500 group-hover:bg-gray-200"
        }`}
      >
        <Icon className="w-[18px] h-[18px]" />
      </div>
      <h3 className={`text-sm font-semibold ${primary ? "text-blue-700" : "text-gray-900"}`}>
        {title}
      </h3>
      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{description}</p>
    </Link>
  );
}

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
  const colors: Record<string, string> = {
    blue: "bg-blue-100 text-blue-600",
    green: "bg-green-100 text-green-600",
    red: "bg-red-100 text-red-600",
    amber: "bg-amber-100 text-amber-600",
  };
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
        <AlertCircle className="w-3.5 h-3.5 text-gray-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-700">{text}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-gray-400">{time}</span>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${colors[tagColor] || colors.blue}`}>
            {tag}
          </span>
        </div>
      </div>
    </div>
  );
}
