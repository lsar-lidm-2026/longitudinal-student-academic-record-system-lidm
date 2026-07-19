/**
 * Environment Configuration — Centralized Config Object
 * ======================================================
 *
 * Cara Kerja:
 * 1. Mengeksekusi side-effect import "./load-env" untuk memuat file .env ke process.env (via dotenv).
 * 2. Membaca semua konfigurasi dari Bun.env dan menyimpannya dalam object `env` yang diekspor.
 * 3. Setiap properti memiliki nilai default (fallback) jika tidak di-set di environment.
 * 4. Menyediakan fungsi helper (llmConfigured, s3Configured) untuk validasi konfigurasi opsional.
 * 5. Logger mencatat level logging dan status konfigurasi LLM/S3 saat modul dimuat.
 *
 * Alur Lengkap:
 * - import "./load-env" → Load .env file → Baca Bun.env → Inisialisasi object env →
 *   Log status konfigurasi → Ekspor env untuk digunakan di seluruh aplikasi
 *
 * Dependencies:
 * - ./load-env: Side-effect import untuk memuat file .env via dotenv
 * - ./logger: Pino logger — mencatat konfigurasi yang dimuat (tidak digunakan langsung di sini karena
 *   env digunakan oleh logger itu sendiri; logger diimpor di index.ts)
 */

import "./load-env";

/**
 * Object konfigurasi utama yang diekspor ke seluruh aplikasi.
 * Semua nilai dibaca dari environment variable dengan fallback ke default.
 */
export const env = {
  // Port server — default 3001 untuk development
  port: parseInt(Bun.env.PORT || "3001", 10),

  // Database connection string untuk Prisma (PostgreSQL)
  databaseUrl: Bun.env.DATABASE_URL || "",

  // JWT — wajib di .env, diverifikasi di index.ts saat startup
  jwtSecret: Bun.env.JWT_SECRET || "",
  jwtExpiresIn: Bun.env.JWT_EXPIRES_IN || "7d",

  // LLM — custom endpoint OpenAI-compatible (untuk AI summary & chatbot)
  llmApiKey: Bun.env.AI_LLM_API_KEY || "",
  llmBaseUrl: Bun.env.AI_LLM_BASE_URL || "",
  llmModel: Bun.env.AI_LLM_MODEL || "",

  /** Validasi LLM config — true jika semua env var LLM yang diperlukan sudah di-set */
  llmConfigured: (): boolean => {
    return !!(Bun.env.AI_LLM_API_KEY && Bun.env.AI_LLM_BASE_URL && Bun.env.AI_LLM_MODEL);
  },

  // S3 / Object Storage — untuk upload file (rapor, foto siswa, dll)
  s3Endpoint: Bun.env.S3_ENDPOINT || "",
  s3AccessKey: Bun.env.S3_ACCESS_KEY || "",
  s3SecretKey: Bun.env.S3_SECRET_KEY || "",
  s3Region: Bun.env.S3_DEFAULT_REGION || "us-east-1",
  s3Bucket: Bun.env.S3_BUCKET || "lsar",

  /** Validasi S3 config — true jika semua env var S3 yang diperlukan sudah di-set */
  s3Configured: (): boolean => {
    return !!(Bun.env.S3_ENDPOINT && Bun.env.S3_ACCESS_KEY && Bun.env.S3_SECRET_KEY);
  },

  // Analytics / Clustering — K-Means untuk clustering siswa
  clusteringEnabled: Bun.env.CLUSTERING_ENABLED === "true",
  modelPath: Bun.env.MODEL_PATH || "./models",
  clusterRetrainIntervalMs: parseInt(Bun.env.CLUSTER_RETRAIN_INTERVAL || "21600000", 10), // Default 6 jam

  // SMTP — email delivery untuk password reset dan notifikasi
  smtpHost: Bun.env.SMTP_HOST || "smtp.gmail.com",          // Host SMTP server
  smtpPort: parseInt(Bun.env.SMTP_PORT || "587", 10),        // Port SMTP (465 untuk SSL, 587 untuk TLS)
  smtpUser: Bun.env.SMTP_USER || "",                         // Username/email akun SMTP
  smtpPass: Bun.env.SMTP_PASS || "",                         // Password aplikasi SMTP
  smtpFrom: Bun.env.SMTP_FROM || "LSAR System <noreply@lsar.sch.id>", // Alamat pengirim email

  // App URL — untuk link reset password yang dikirim via email
  appUrl: Bun.env.APP_URL || "http://localhost:3000",

  // Logging — level default "info"
  logLevel: Bun.env.LOG_LEVEL || "info",
};
