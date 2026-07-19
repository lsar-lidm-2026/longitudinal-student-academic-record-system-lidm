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

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, BellDot, Loader2, User, X } from "lucide-react";
import { api } from "@/lib/api";
import { logger } from "@/lib/logger";
import type { DashboardSummary, JwtPayload } from "../../types";

const MODULE = "TopHeader"; /** Nama module untuk logger */

/** Interface untuk props TopHeader */
interface TopHeaderProps {
  user: JwtPayload;       /** Data user dari hasil autentikasi */
  breadcrumb?: string;    /** Teks breadcrumb halaman saat ini (opsional) */
}

/**
 * getRoleLabel — Mapping role kode (EN) ke label Bahasa Indonesia.
 *
 * @param role - Kode role dari backend (string)
 * @returns Label role dalam Bahasa Indonesia
 */
function getRoleLabel(role: string) {
  switch (role) {
    case "ADMINISTRATOR": return "Administrator";
    case "OPERATOR_SEKOLAH": return "Operator";
    case "GURU": return "Wali Kelas";
    case "KEPALA_SEKOLAH": return "Kepala Sekolah";
    default: return role; /** Fallback: return raw role code */
  }
}

/**
 * TopHeader — Header bar dashboard dengan breadcrumb, notifikasi, dan user menu.
 *
 * @param user - Object JwtPayload berisi data user (name, role, dll)
 * @param breadcrumb - String breadcrumb untuk halaman saat ini
 */
export function TopHeader({ user, breadcrumb }: TopHeaderProps) {
  logger.debug(MODULE, "Render TopHeader", {
    userName: user.name,
    role: user.role,
    breadcrumb: breadcrumb || "Dashboard",
  });

  /** Jumlah notifikasi (pending AI drafts) — 0 saat loading atau error */
  const [notifCount, setNotifCount] = useState(0);
  /** Indikator loading notifikasi */
  const [notifLoading, setNotifLoading] = useState(true);
  /** State buka/tutup dropdown panel notifikasi */
  const [dropdownOpen, setDropdownOpen] = useState(false);
  /** Ref untuk mendeteksi klik di luar dropdown (auto-close) */
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  /** Fetch data saat komponen mount */
  useEffect(() => {
    fetchNotificationCount();
  }, []);

  /**
   * Auto-close dropdown ketika user klik di luar elemen dropdown.
   * Listener dipasang di document — hanya aktif jika dropdownOpen = true.
   */
  useEffect(() => {
    if (!dropdownOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
        logger.debug(MODULE, "Dropdown closed — clicked outside");
      }
    }

    // Delay pemasangan listener untuk menghindari event klik yang sama yang membuka dropdown
    const timer = setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", handleClickOutside);
    };
  }, [dropdownOpen]);

  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-center shrink-0 w-full">
      <div className="w-full max-w-7xl px-6 flex items-center justify-between">
        {/* Left: Breadcrumb — menunjukkan lokasi halaman saat ini */}
        <div className="text-sm text-gray-500">
          {breadcrumb || "Dashboard"}
        </div>

        {/* Right: Notification Bell + User Info */}
        <div className="flex items-center gap-4">
          {/* Notifications Button — dengan badge count dan dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => {
                setDropdownOpen(!dropdownOpen);
                logger.debug(MODULE, "Notification bell clicked", { dropdownOpen: !dropdownOpen });
              }}
              className="relative w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors"
              aria-label="Notifikasi"
            >
              {/* Tampilkan BellDot jika ada notifikasi, Bell jika tidak ada */}
              {notifCount > 0 ? (
                <BellDot className="w-4 h-4" />
              ) : (
                <Bell className="w-4 h-4" />
              )}

              {/* Badge notifikasi — jumlah count */}
              {notifLoading ? (
                /* Loading state: spinner kecil sebagai badge */
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-gray-300 rounded-full flex items-center justify-center">
                  <Loader2 className="w-2.5 h-2.5 text-white animate-spin" />
                </span>
              ) : notifCount > 0 ? (
                /* Ada notifikasi: badge biru dengan angka */
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-blue-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none shadow-sm">
                  {notifCount > 99 ? "99+" : notifCount}
                </span>
              ) : (
                /* Tidak ada notifikasi: titik abu-abu kecil */
                <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-gray-300 rounded-full" />
              )}
            </button>

            {/* Dropdown Panel Notifikasi — tampil jika dropdownOpen = true */}
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl border border-gray-100 shadow-lg z-50 overflow-hidden">
                {/* Header dropdown */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                  <h3 className="text-sm font-semibold text-gray-900">Notifikasi</h3>
                  <button
                    onClick={() => setDropdownOpen(false)}
                    className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors"
                    aria-label="Tutup notifikasi"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Konten notifikasi */}
                <div className="max-h-64 overflow-y-auto">
                  {notifLoading ? (
                    /* Loading state */
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                    </div>
                  ) : notifCount === 0 ? (
                    /* Empty state: tidak ada notifikasi */
                    <div className="flex flex-col items-center justify-center py-8 px-4">
                      <Bell className="w-8 h-8 text-gray-200 mb-2" />
                      <p className="text-sm text-gray-400">Tidak ada notifikasi</p>
                      <p className="text-xs text-gray-300 mt-0.5">Semua data sudah diperbarui</p>
                    </div>
                  ) : (
                    /* Daftar notifikasi — satu item per tipe notifikasi */
                    <div className="divide-y divide-gray-50">
                      {/* Notifikasi: AI Draft perlu review */}
                      <Link
                        href="/ml"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-blue-50/50 transition-colors group"
                      >
                        <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center shrink-0 mt-0.5">
                          <BellDot className="w-3.5 h-3.5 text-purple-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-700 group-hover:text-gray-900">
                            <strong>{notifCount} draft AI</strong> menunggu tinjauan
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Review dan finalisasi ringkasan AI siswa
                          </p>
                        </div>
                        <span className="text-[10px] text-blue-500 font-medium shrink-0 mt-0.5">
                          Baru
                        </span>
                      </Link>
                    </div>
                  )}
                </div>

                {/* Footer link ke semua notifikasi */}
                {!notifLoading && notifCount > 0 && (
                  <div className="border-t border-gray-50 px-4 py-2.5">
                    <Link
                      href="/ml"
                      onClick={() => setDropdownOpen(false)}
                      className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      Lihat semua draft AI →
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* User Info Section */}
          <div className="flex items-center gap-2.5 pl-3 border-l border-gray-100">
            {/* Nama + Role (hidden di layar kecil — sm:block) */}
            <div className="text-right hidden sm:block">
              <p className="text-[13px] font-medium text-gray-900 leading-tight">{user.name}</p>
              <p className="text-[11px] text-gray-400">{getRoleLabel(user.role)}</p>
            </div>
            {/* Avatar placeholder — lingkaran dengan icon user */}
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
              <User className="w-4 h-4 text-gray-500" />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
