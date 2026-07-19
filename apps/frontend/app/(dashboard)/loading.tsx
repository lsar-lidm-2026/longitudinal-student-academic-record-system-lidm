/**
 * Dashboard Loading — LSAR Frontend
 * ===================================
 * Cara Kerja:
 * 1. File ini adalah loading.tsx untuk route group (dashboard).
 * 2. Next.js App Router akan menampilkan komponen ini secara otomatis
 *    saat halaman dashboard sedang melakukan streaming/server fetching.
 * 3. Menampilkan spinner animasi di tengah layar dengan teks "Memuat...".
 *
 * Alur:
 * - User navigasi ke halaman di (dashboard) → Next.js tampilkan loading.tsx
 * - Server selesai fetch data → Next.js ganti dengan halaman sebenarnya
 * - Transisi otomatis — tanpa perlu state management manual
 *
 * NOTE: File ini SERVER COMPONENT secara default. Tidak bisa menggunakan
 * hooks atau event handlers karena tidak ada "use client" directive.
 */

export default function DashboardLoading() {
  return (
    /* Container flex untuk centering di tengah viewport */
    <div className="flex items-center justify-center min-h-[60vh]">
      {/* Kolom vertikal: spinner + teks */}
      <div className="flex flex-col items-center gap-3">
        {/* Spinner melingkar dengan border biru, transparan di satu sisi */}
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
        {/* Teks loading dengan warna muted */}
        <p className="text-sm text-muted-foreground">Memuat...</p>
      </div>
    </div>
  );
}
