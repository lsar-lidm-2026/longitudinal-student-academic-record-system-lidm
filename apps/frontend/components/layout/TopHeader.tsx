/**
 * TopHeader — Komponen header bar di bagian atas dashboard (breadcrumb + notifikasi + user info).
 * ================================================================================================
 *
 * Cara Kerja:
 * 1. Komponen menerima `user` (JwtPayload) dan `breadcrumb` (string opsional) sebagai props.
 * 2. Tampilkan:
 *    a. Kiri: Breadcrumb text (default: "Dashboard")
 *    b. Kanan: Icon notifikasi (bell) dengan badge count real-time, dan info user (avatar + nama + role)
 * 3. Notifikasi:
 *    a. useEffect fetch GET /dashboard/summary → ambil pendingAiDrafts sebagai count.
 *    b. Klik bell → toggle dropdown panel dengan daftar notifikasi.
 *    c. Klik luar dropdown → tutup dropdown (useEffect + document click listener).
 * 4. `getRoleLabel(role)` mapping role kode ke label Bahasa Indonesia.
 * 5. Layout menggunakan flexbox dengan max-width container.
 *
 * Alur Lengkap:
 *   <TopHeader user={currentUser} breadcrumb="Data Siswa" />
 *       │
 *       ├─ Left: Breadcrumb
 *       │       └─ {breadcrumb || "Dashboard"}
 *       │
 *       └─ Right: Action items
 *               ├─ Notifikasi (bell icon + badge count)
 *               │       └─ Dropdown panel (tampil jika diklik)
 *               │           ├─ "X notifikasi" header
 *               │           ├─ Daftar item notifikasi
 *               │           │   ├─ AI draft perlu review → link ke /ml
 *               │           │   └─ "Tidak ada notifikasi" jika kosong
 *               │           └─ Link ke halaman review
 *               └─ User info
 *                       ├─ Nama + Role label (hidden di mobile)
 *                       └─ Avatar lingkaran (icon user default)
 *
 * Logger:
 * - debug: render TopHeader.
 * - info: fetch notifikasi berhasil/set notification count.
 * - error: fetch notifikasi gagal.
 */

"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Bell,
  BellDot,
  Loader2,
  User,
  LogOut,
  Settings,
  HelpCircle,
  Calendar,
  ChevronDown,
  Clock,
  ShieldAlert,
  Activity,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { logger } from "@/lib/logger";
import type { DashboardSummary, JwtPayload } from "../../types";

const MODULE = "TopHeader"; /** Nama module untuk logger */

/** Interface untuk props TopHeader */
interface TopHeaderProps {
  user: JwtPayload;       /** Data user dari hasil autentikasi */
  breadcrumb?: string;    /** Teks breadcrumb halaman saat ini (opsional) */
}

function getRoleConfig(role: string) {
  switch (role) {
    case "ADMINISTRATOR":
      return { label: "Admin", badge: "bg-red-50 text-red-600 border-red-100" };
    case "OPERATOR_SEKOLAH":
      return { label: "Operator", badge: "bg-amber-50 text-amber-600 border-amber-100" };
    case "GURU":
      return { label: "Wali Kelas", badge: "bg-blue-50 text-blue-600 border-blue-100" };
    case "KEPALA_SEKOLAH":
      return { label: "Kepsek", badge: "bg-emerald-50 text-emerald-600 border-emerald-100" };
    default:
      return { label: role, badge: "bg-gray-50 text-gray-600 border-gray-100" };
  }
}

function getPageTitle(pathname: string): string {
  if (pathname === "/") return "Dashboard Utama";
  if (pathname.startsWith("/students/")) {
    if (pathname.endsWith("/semester-records")) return "Input Nilai Semester";
    if (pathname.endsWith("/buku-induk")) return "Arsip Buku Induk Siswa";
    if (pathname.endsWith("/ai")) return "AI Analisis Siswa";
    return "Profil Detail Siswa";
  }
  if (pathname === "/students") return "Data Master Siswa";
  if (pathname === "/ml") return "AI Analisis Dashboard";
  if (pathname === "/classes") return "Buku Induk (Daftar Kelas)";
  if (pathname === "/settings") return "Pengaturan Sistem";
  if (pathname === "/users") return "Manajemen Pengguna";
  if (pathname === "/academic-years") return "Manajemen Tahun Ajaran";
  return "LSAR System";
}

export function TopHeader({ user, breadcrumb }: TopHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [formattedDate, setFormattedDate] = useState("");
  
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  /** Jumlah notifikasi (pending AI drafts) — 0 saat loading atau error */
  const [notifCount, setNotifCount] = useState(0);
  /** Indikator loading notifikasi */
  const [notifLoading, setNotifLoading] = useState(true);

  /**
   * fetchNotificationCount — Fetch dashboard summary dan ambil pendingAiDrafts sebagai count notifikasi.
   * Jika gagal, log error dan set count ke 0.
   */
  function fetchNotificationCount() {
    logger.info(MODULE, "Fetching notification count");
    setNotifLoading(true);
    api.handleResponse(api.get<DashboardSummary>("/dashboard/summary"))
      .then((data) => {
        const count = data.pendingAiDrafts ?? 0;
        setNotifCount(count);
        logger.info(MODULE, "Notification count fetched", { count });
      })
      .catch((err) => {
        logger.error(MODULE, "Failed to fetch notification count", { error: err.message });
        setNotifCount(0);
      })
      .finally(() => setNotifLoading(false));
  }

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Set local date format in Indonesian and fetch notifications count
  useEffect(() => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    setFormattedDate(new Date().toLocaleDateString("id-ID", options));
    fetchNotificationCount();
  }, []);

  // Sync title to document title
  useEffect(() => {
    const pageTitle = getPageTitle(pathname);
    document.title = `LSAR - ${pageTitle}`;
  }, [pathname]);

  function handleLogout() {
    api.setToken(null);
    router.replace("/login");
  }

  const roleInfo = getRoleConfig(user.role);

  return (
    <header className="h-14 bg-white/80 backdrop-blur-md border-b border-gray-100 flex items-center justify-center shrink-0 w-full sticky top-0 z-30 shadow-sm/5">
      <div className="w-full max-w-7xl px-6 flex items-center justify-between">
        {/* Left: Dynamic Page Title + Indonesian Date + Live Connection Badge */}
        <div className="flex items-center gap-3">
          <div className="text-sm font-bold text-gray-900 tracking-tight">
            {getPageTitle(pathname)}
          </div>
          {formattedDate && (
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 bg-gray-50 rounded-full border border-gray-100 text-[11px] text-gray-500 font-medium">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              {formattedDate}
            </div>
          )}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100/50 text-[10px] font-bold">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            Sistem Aktif
          </div>
        </div>

        {/* Right: Actions (Notif & User Dropdown) */}
        <div className="flex items-center gap-3">
          {/* Notifications Panel */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setIsNotifOpen(!isNotifOpen)}
              className={`relative w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-all border ${
                isNotifOpen ? "bg-blue-50 border-blue-200 text-blue-600" : "border-gray-200/50 bg-white"
              }`}
            >
              {notifCount > 0 ? (
                <>
                  <BellDot className="w-4 h-4 text-blue-600" />
                  <span className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full ring-2 ring-white animate-pulse" />
                </>
              ) : (
                <Bell className="w-4 h-4" />
              )}
            </button>

            {/* Notifications Popover */}
            {isNotifOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl border border-gray-100 shadow-xl py-3 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
                <div className="px-4 pb-2.5 border-b border-gray-50 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-gray-800">Pemberitahuan</h3>
                  {notifCount > 0 && (
                    <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-semibold">
                      {notifCount} Baru
                    </span>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto mt-1">
                  {notifLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                    </div>
                  ) : notifCount === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                      <Bell className="w-8 h-8 text-gray-200 mb-2" />
                      <p className="text-xs font-bold text-gray-400">Tidak ada notifikasi baru</p>
                      <p className="text-[10px] text-gray-300 mt-0.5">Semua draft AI sudah ditinjau</p>
                    </div>
                  ) : (
                    <Link
                      href="/ml"
                      onClick={() => setIsNotifOpen(false)}
                      className="block hover:bg-gray-50 transition-colors"
                    >
                      <NotificationItem
                        title="Draft AI Perlu Ditinjau"
                        description={`${notifCount} draft ringkasan AI siswa menunggu persetujuan.`}
                        time="Baru"
                        unread
                      />
                    </Link>
                  )}
                </div>
                {notifCount > 0 && (
                  <div className="px-4 pt-2.5 border-t border-gray-50 text-center">
                    <Link
                      href="/ml"
                      onClick={() => setIsNotifOpen(false)}
                      className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
                    >
                      Lihat Semua Draft AI →
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* User Profile Dropdown */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className={`flex items-center gap-2.5 p-1.5 pr-3 rounded-xl border transition-all hover:bg-gray-50/80 active:bg-gray-100/50 ${
                isProfileOpen ? "bg-gray-50 border-gray-300" : "border-gray-200/50 bg-white"
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white shadow-sm font-bold text-sm shrink-0">
                {user.name.charAt(0)}
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-[13px] font-bold text-gray-900 leading-none">{user.name}</p>
                <span className={`inline-flex items-center text-[10px] font-bold mt-1 px-1.5 py-0.5 rounded border ${roleInfo.badge}`}>
                  {roleInfo.label}
                </span>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${isProfileOpen ? "rotate-180" : ""}`} />
            </button>

            {/* Profile Dropdown Box */}
            {isProfileOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl border border-gray-100 shadow-xl py-2.5 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
                <div className="px-4 py-2 border-b border-gray-50">
                  <p className="text-xs text-gray-400">Masuk sebagai</p>
                  <p className="text-sm font-bold text-gray-800 truncate mt-0.5">{user.name}</p>
                  <p className="text-[10px] font-mono text-gray-500 truncate mt-0.5">{user.username}@sekolah.sch.id</p>
                </div>
                <div className="p-1.5 space-y-0.5">
                  <DropdownLink href="/settings" icon={User} label="Profil Saya" onClick={() => setIsProfileOpen(false)} />
                  <DropdownLink href="/settings" icon={Settings} label="Pengaturan" onClick={() => setIsProfileOpen(false)} />
                  {/* Pusat Bantuan: disabled span — tidak ada halaman bantuan di MVP */}
                  <span className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-gray-300 cursor-not-allowed font-medium select-none">
                    <HelpCircle className="w-4 h-4 text-gray-300" />
                    Pusat Bantuan
                  </span>
                </div>
                <div className="border-t border-gray-50 p-1.5 mt-1.5">
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs text-red-500 hover:bg-red-50 font-medium transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Keluar Sesi
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

// ── Dropdown Link Component ──────────────────────────────────────────

function DropdownLink({
  href,
  icon: Icon,
  label,
  onClick,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-gray-600 hover:bg-gray-50 hover:text-gray-800 font-medium transition-colors"
    >
      <Icon className="w-4 h-4 text-gray-400" />
      {label}
    </Link>
  );
}

// ── Notification Item Component ──────────────────────────────────────

function NotificationItem({
  title,
  description,
  time,
  unread,
}: {
  title: string;
  description: string;
  time: string;
  unread?: boolean;
}) {
  return (
    <div className={`px-4 py-3 flex items-start gap-3 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors ${unread ? "bg-blue-50/20" : ""}`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${unread ? "bg-blue-50 text-blue-600" : "bg-gray-50 text-gray-400"}`}>
        <Clock className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <p className={`text-xs font-bold truncate ${unread ? "text-gray-900" : "text-gray-700"}`}>{title}</p>
          {unread && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full shrink-0" />}
        </div>
        <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed line-clamp-2">{description}</p>
        <span className="text-[9px] text-gray-400 mt-1 block">{time}</span>
      </div>
    </div>
  );
}
