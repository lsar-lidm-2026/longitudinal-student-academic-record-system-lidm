/**
 * Dashboard Error — LSAR Frontend
 * =================================
 * Cara Kerja:
 * 1. File ini adalah error.tsx untuk route group (dashboard).
 * 2. Next.js App Router akan menampilkan komponen ini ketika terjadi
 *    error runtime di halaman atau komponen children.
 * 3. Error "use client" karena membutuhkan props error (Error object)
 *    dan reset (function untuk retry) dari Next.js.
 * 4. Menampilkan ikon X merah, judul, pesan error, dan tombol "Coba Lagi".
 * 5. Tombol "Coba Lagi" memanggil reset() — Next.js akan mencoba
 *    re-render komponen yang gagal.
 *
 * Alur:
 * - Terjadi error di komponen anak (runtime/throw) → Next.js menangkap
 * - Next.js render error.tsx sebagai fallback UI
 * - User melihat pesan error + tombol retry
 * - User klik "Coba Lagi" → reset() dipanggil → Next.js coba render ulang
 * - Jika sukses → error.tsx diganti dengan konten normal
 * - Jika gagal lagi → error.tsx tetap tampil (user bisa refresh browser)
 *
 * Logger:
 * - Log error saat error.tsx dirender.
 * - Log info saat user menekan tombol retry.
 */

"use client";

import { logger } from "@/lib/logger";
import { useEffect } from "react";

/**
 * DashboardError — Fallback UI ketika terjadi error di halaman dashboard.
 *
 * @param error — Error object dari Next.js (memiliki message, digest).
 * @param reset — Fungsi untuk mencoba re-render komponen yang gagal.
 * @returns JSX tampilan error dengan tombol retry.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  /* Log error ke console saat komponen dirender */
  useEffect(() => {
    logger.error("DashboardError", "Page error caught", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    /* Container flex untuk centering */
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-8">
      {/* Ikon lingkaran merah dengan X putih */}
      <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
        <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
      {/* Judul */}
      <h2 className="text-xl font-semibold text-gray-900">Terjadi Kesalahan</h2>
      {/* Pesan error — fallback ke teks default jika tidak ada message */}
      <p className="text-sm text-gray-500 max-w-md">
        {error.message || "Halaman tidak dapat dimuat. Silakan coba lagi."}
      </p>
      {/* Tombol retry — panggil reset() untuk re-render */}
      <button
        onClick={() => {
          logger.info("DashboardError", "User clicked retry");
          reset();
        }}
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
      >
        Coba Lagi
      </button>
    </div>
  );
}
