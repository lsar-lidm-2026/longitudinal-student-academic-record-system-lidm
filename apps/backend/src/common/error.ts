/**
 * Error Classes — Custom Application Error Hierarchy
 * ===================================================
 *
 * Cara Kerja:
 * 1. AppError adalah base class untuk semua error aplikasi yang memiliki statusCode HTTP.
 * 2. Setiap subclass mewakili tipe error spesifik dengan kode dan status HTTP yang fixed.
 * 3. Global error handler di index.ts menangkap instance AppError dan mengubahnya
 *    menjadi response API yang sesuai (membaca .statusCode, .code, .message).
 * 4. Logger mencatat setiap pembuatan error untuk debugging dan audit trail.
 *
 * Alur Lengkap:
 * - Service/Controller melempar(new NotFoundError("Siswa tidak ditemukan")) →
 *   Global onError handler menangkap → Membaca statusCode & code →
 *   Mengembalikan response error({ success: false, error: { code, message } })
 *
 * Dependencies:
 * - ./logger: Pino logger — mencatat setiap error yang dibuat (kecuali untuk
 *   error yang terlalu sering seperti validasi biasa)
 * - Global error handler di index.ts yang menangani AppError instances
 */

import logger from "../lib/logger";

/**
 * AppError — Base class untuk semua custom application error.
 * Extends Error bawaan JavaScript dengan menambahkan statusCode HTTP dan kode machine-readable.
 */
export class AppError extends Error {
  /**
   * @param statusCode HTTP status code (e.g. 401, 403, 404, 409, 500)
   * @param code Machine-readable error code (e.g. "UNAUTHORIZED", "NOT_FOUND")
   * @param message Human-readable error message
   */
  constructor(
    public statusCode: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

/**
 * UnauthorizedError — HTTP 401, digunakan saat autentikasi gagal.
 * Contoh: token tidak valid, username/password salah.
 */
export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(401, "UNAUTHORIZED", message);
    logger.warn({ errorCode: "UNAUTHORIZED", message }, "UnauthorizedError created");
  }
}

/**
 * ForbiddenError — HTTP 403, digunakan saat user tidak memiliki akses.
 * Contoh: guru mencoba mengakses data siswa dari kelas lain.
 */
export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(403, "FORBIDDEN", message);
    logger.warn({ errorCode: "FORBIDDEN", message }, "ForbiddenError created");
  }
}

/**
 * NotFoundError — HTTP 404, digunakan saat resource tidak ditemukan.
 * Contoh: ID siswa tidak ada di database.
 */
export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(404, "NOT_FOUND", message);
    logger.warn({ errorCode: "NOT_FOUND", message }, "NotFoundError created");
  }
}

/**
 * ValidationError — HTTP 400, digunakan saat validasi input gagal.
 * Contoh: field required tidak diisi, format data salah.
 */
export class ValidationError extends AppError {
  constructor(message = "Validation error") {
    super(400, "VALIDATION_ERROR", message);
    logger.warn({ errorCode: "VALIDATION_ERROR", message }, "ValidationError created");
  }
}

/**
 * ConflictError — HTTP 409, digunakan saat terjadi konflik data.
 * Contoh: duplikat username, NISN sudah terdaftar.
 */
export class ConflictError extends AppError {
  constructor(message = "Resource already exists") {
    super(409, "CONFLICT", message);
    logger.warn({ errorCode: "CONFLICT", message }, "ConflictError created");
  }
}

/**
 * AiError — HTTP 502, digunakan saat layanan AI gagal merespon.
 * Contoh: OpenAI API timeout, response tidak valid.
 * Status 502 (Bad Gateway) karena AI adalah upstream service.
 */
export class AiError extends AppError {
  constructor(message = "AI service error") {
    super(502, "AI_ERROR", message);
    logger.error({ errorCode: "AI_ERROR", message }, "AiError created");
  }
}
