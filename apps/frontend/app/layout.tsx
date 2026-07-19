/**
 * Root Layout — LSAR Frontend
 * =============================
 * Cara Kerja:
 * 1. File ini adalah root layout Next.js App Router yang membungkus semua halaman.
 * 2. Mengimpor font Geist (Sans & Mono) dari next/font/google untuk digunakan
 *    secara global melalui CSS variable --font-geist-sans dan --font-geist-mono.
 * 3. Mengimpor globals.css yang berisi Tailwind directives, design tokens, dan print styles.
 * 4. Mengekspor metadata statis (title & description) untuk SEO.
 * 5. Render children di dalam <html lang="id"> dengan class font dan body styling.
 *
 * Alur:
 * - Next.js membaca layout.tsx sebagai wrapper tertinggi.
 * - Font Geist di-preload dan disimpan di CSS variables.
 * - globals.css memberikan styling global (Tailwind + theme tokens).
 * - children akan diisi oleh halaman atau layout turunan (auth/dashboard).
 *
 * IMPORTANT: File ini SERVER COMPONENT — tidak bisa pakai hooks atau event handlers.
 */

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

/**
 * Konfigurasi font Geist Sans.
 * @constant {object} geistSans — Menyimpan CSS variable dan subset latin untuk font sans-serif.
 */
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

/**
 * Konfigurasi font Geist Mono.
 * @constant {object} geistMono — Menyimpan CSS variable dan subset latin untuk font monospace.
 */
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Metadata statis untuk SEO.
 * Ditampilkan di title tab browser dan deskripsi search engine.
 */
export const metadata: Metadata = {
  title: "LSAR - Longitudinal Student Academic Record",
  description: "Sistem pencatatan riwayat akademik siswa berbasis AI",
};

/**
 * RootLayout — Komponen layout tertinggi aplikasi.
 *
 * @param children — Content dari halaman atau layout turunan (auth/dashboard).
 * @returns JSX element <html> dengan font variables dan body styling.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    /* <html> dengan atribut lang="id" untuk bahasa Indonesia */
    <html lang="id" className={`${geistSans.variable} ${geistMono.variable}`}>
      {/* Body: min-h-screen, bg-gray-50, font-sans, antialiased */}
      <body className="min-h-screen bg-gray-50 font-sans antialiased">{children}</body>
    </html>
  );
}
