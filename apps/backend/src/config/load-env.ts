/**
 * Dotenv Loader — Load .env File
 * ================================
 *
 * Cara Kerja:
 * 1. Mengimpor fungsi `config` dari library `dotenv`.
 * 2. Menentukan path ke file .env relatif terhadap lokasi file ini
 *    menggunakan `import.meta.url` (standar ESM untuk path file saat ini).
 *    Path: ../../.env (dari direktori src/config/ ke root proyek backend).
 * 3. Memanggil config() untuk membaca file .env dan mengisi process.env / Bun.env.
 * 4. File ini adalah side-effect import — dipanggil oleh env.ts untuk memastikan
 *    environment terisi sebelum konfigurasi dibaca.
 *
 * Alur Lengkap:
 * - env.ts import "./load-env" → load-env.ts membaca .env file →
 *   Semua variabel tersedia di Bun.env → env.ts membacanya
 *
 * Dependencies:
 * - dotenv: Library untuk membaca file .env ke process.env
 */

import { config } from "dotenv";

// Load .env file dari root backend directory (2 level di atas folder config/)
config({ path: new URL("../../.env", import.meta.url).pathname });