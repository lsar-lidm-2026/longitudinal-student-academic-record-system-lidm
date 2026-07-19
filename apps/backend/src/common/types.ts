/**
 * Shared TypeScript Types — Core Type Definitions
 * ================================================
 *
 * Cara Kerja:
 * 1. Mendefinisikan tipe-tipe dasar yang digunakan di seluruh aplikasi backend.
 * 2. ApiResponse<T> adalah format respons standar yang dikembalikan oleh semua endpoint API.
 * 3. JwtPayload adalah struktur data yang di-decode dari token JWT.
 * 4. PaginationParams adalah parameter pagination standar untuk query terpaginasi.
 * 5. Role diimpor dari Prisma generated client untuk konsistensi dengan database enum.
 *
 * Alur Lengkap:
 * - Semua controller/service mengimpor tipe dari sini untuk type safety
 * - Setiap response API mengikuti format ApiResponse<T>
 *
 * Dependencies:
 * - ../generated/prisma/client: Prisma generated types (Role enum)
 */

import { Role } from "../generated/prisma/client";

/**
 * ApiResponse<T> — Format respons standar untuk semua endpoint API.
 * Konsisten digunakan di seluruh controller untuk response success/error.
 * @template T Tipe data yang dikembalikan (payload response)
 */
export interface ApiResponse<T = unknown> {
  success: boolean;        // Indikator apakah request berhasil
  data?: T;               // Payload response (ada jika success=true)
  error?: {               // Detail error (ada jika success=false)
    code: string;          // Kode error machine-readable (e.g. "UNAUTHORIZED", "NOT_FOUND")
    message: string;       // Pesan error human-readable
  };
  meta?: {                 // Metadata pagination (ada jika endpoint terpaginasi)
    page: number;          // Halaman saat ini
    limit: number;         // Jumlah item per halaman
    total: number;         // Total jumlah item
  };
}

/**
 * JwtPayload — Struktur data yang di-decode dari token JWT.
 * Digunakan oleh requireAuth middleware untuk menyimpan informasi user ke context.
 */
export interface JwtPayload {
  userId: string;              // UUID user dari database
  username: string;            // Username untuk login
  role: Role;                  // Role user (Administrator / Guru) — dari Prisma enum
  name: string;                // Nama lengkap user
  refreshTokenVersion?: number; // Versi refresh token untuk deteksi rotasi
  iat?: number;                // Issued at timestamp (opsional, dari JWT)
}

/**
 * PaginationParams — Parameter pagination standar.
 * Digunakan oleh parsePagination() untuk ekstraksi dari query string.
 */
export interface PaginationParams {
  page: number;   // Nomor halaman (1-indexed)
  limit: number;  // Jumlah item per halaman
}
