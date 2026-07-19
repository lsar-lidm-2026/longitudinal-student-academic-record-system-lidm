/**
 * Dashboard Layout — LSAR Frontend
 * ==================================
 * Cara Kerja:
 * 1. Layout ini adalah Client Component ("use client") yang membungkus semua halaman
 *    di dalam route group (dashboard).
 * 2. Saat pertama kali dirender, useEffect berjalan:
 *    a. Cek accessToken dari localStorage.
 *    b. Jika tidak ada, cek cookie (fallback untuk kasus middleware yang set cookie).
 *    c. Jika token tidak ditemukan sama sekali → redirect ke /login.
 *    d. Jika token ada → panggil /auth/me untuk validasi dan dapatkan data user.
 *    e. Jika /auth/me gagal → hapus token dan redirect ke /login.
 * 3. User yang valid akan ditampilkan layout dengan:
 *    - Toaster (notifikasi sonner di pojok kanan atas)
 *    - Sidebar (navigasi kiri)
 *    - TopHeader (navbar atas)
 *    - Main content area dengan ErrorBoundary wrapper
 *    - ChatBot (floating chatbot di kanan bawah)
 *    - Tombol logout di sidebar akan memanggil handleLogout()
 *
 * Alur proteksi:
 * - User buka "/" → layout ini mount → useEffect cek token → validasi ke API →
 *   (a) sukses: tampilkan dashboard | (b) gagal: redirect ke /login
 * - Loading state: spinner fullscreen
 * - Error state / user null: return null (redirect sedang berlangsung)
 *
 * Logger:
 * - Log info saat layout mount dan cek token.
 * - Log error jika token tidak valid atau /auth/me gagal.
 * - Log info saat logout.
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Toaster } from "sonner";
import { Sidebar } from "../../components/layout/Sidebar";
import { TopHeader } from "../../components/layout/TopHeader";
import { ErrorBoundary } from "../../components/ui/ErrorBoundary";
import { ChatBot } from "../../components/chatbot/ChatBot";
import { api } from "../../lib/api";
import type { JwtPayload } from "../../types";
import { logger } from "@/lib/logger";

/**
 * DashboardLayout — Layout utama untuk halaman yang memerlukan autentikasi.
 * Melakukan validasi token dan menampilkan struktur UI dashboard.
 *
 * @param children — Konten halaman spesifik (dashboard, students, classes, dll).
 * @returns JSX layout dengan sidebar, header, main content, dan chatbot.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  /** Router Next.js untuk navigasi dan redirect */
  const router = useRouter();

  /** State data user — hasil decode JWT dari /auth/me */
  const [user, setUser] = useState<JwtPayload | null>(null);

  /** State loading — true selama validasi token dan fetch /auth/me */
  const [loading, setLoading] = useState(true);

  /**
   * Effect untuk validasi autentikasi saat layout mount.
   * Priority: localStorage -> cookie fallback -> redirect ke login.
   * Hanya jalan sekali karena dependency [router].
   */
  useEffect(() => {
    logger.info("DashboardLayout", "Validating authentication...");

    /* Coba ambil token dari localStorage */
    let token = localStorage.getItem("accessToken");

    /* Fallback ke cookie jika tidak ditemukan di localStorage */
    /* Ini terjadi ketika middleware set cookie tapi belum sempat sync ke localStorage */
    if (!token) {
      const match = document.cookie.match(/(?:^|;\s*)accessToken=([^;]*)/);
      if (match) token = match[1];
    }

    /* Jika token benar-benar tidak ada — redirect ke login */
    if (!token) {
      logger.warn("DashboardLayout", "No token found, redirecting to login");
      router.replace("/login");
      return;
    }

    /* Set token ke API client dan validasi ke backend */
    api.setToken(token);

    /* Panggil /auth/me untuk validasi dan dapatkan data user */
    api
      .get<JwtPayload>("/auth/me")
      .then((res) => {
        if (res.success && res.data) {
          /* Token valid — set user data */
          setUser(res.data as JwtPayload);
          logger.info("DashboardLayout", "User authenticated", {
            role: (res.data as JwtPayload).role,
            name: (res.data as JwtPayload).name,
          });
        } else {
          /* Token invalid/expired — hapus token dan redirect */
          logger.error("DashboardLayout", "Token validation failed, redirecting to login");
          api.setToken(null);
          router.replace("/login");
        }
      })
      .finally(() => setLoading(false));
  }, [router]);

  /**
   * handleLogout — Fungsi untuk logout.
   * Panggil backend /auth/logout, hapus token dari API client, redirect ke login.
   */
  async function handleLogout() {
    logger.info("DashboardLayout", "User logging out");
    try { await api.post("/auth/logout", {}); } catch {}
    api.setToken(null);
    router.replace("/login");
  }

  /* ── Loading State ──────────────────────────────────────── */
  /* Tampilkan spinner saat validasi token berlangsung */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          {/* Spinner animasi */}
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
          <p className="text-sm text-muted-foreground">Memuat...</p>
        </div>
      </div>
    );
  }

  /* ── Null State ─────────────────────────────────────────── */
  /* Jika user null setelah loading selesai — berarti redirect sudah terjadi */
  if (!user) {
    return null;
  }

  /* ── Render Layout ──────────────────────────────────────── */
  return (
    /* Container flex horizontal: sidebar kiri + konten kanan */
    <div className="flex h-screen overflow-hidden bg-gray-50/50">
      {/* Toaster notifikasi — pojok kanan atas dengan warna kaya (sukses=hijau, error=merah) */}
      <Toaster richColors position="top-right" />

      {/* Sidebar navigasi — role untuk menu, userName untuk display, onLogout untuk tombol keluar */}
      <Sidebar role={user.role} userName={user.name} onLogout={handleLogout} />

      {/* Area konten utama — flex column: header di atas, main content di bawah */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top header bar — menampilkan user info, breadcrumb, dll */}
        <TopHeader user={user} />

        {/* Main content — scrollable, dengan max-width 7xl (1280px) */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto w-full p-6">
            {/* ErrorBoundary menangkap error di komponen children */}
            <ErrorBoundary>{children}</ErrorBoundary>
          </div>
        </main>
      </div>

      {/* Floating ChatBot — asisten AI untuk membantu guru */}
      <ChatBot />
    </div>
  );
}
