/**
 * Entry Point — LSAR Backend Server
 * ==================================
 *
 * Cara Kerja:
 * 1. Memuat konfigurasi dari environment (env.ts) dan melakukan validasi variabel kritis (JWT_SECRET).
 * 2. Membuat instance Elysia, memasang plugin CORS dan Swagger (dokumentasi API di /docs).
 * 3. Mendaftarkan global error handler (.onError) yang menangani:
 *    - Route tidak ditemukan (NOT_FOUND → 404)
 *    - Custom AppError (statusCode dari kelas error)
 *    - Prisma errors (P2002 duplikat, P2025 not found, P2003 referensi)
 *    - Validasi Elysia (VALIDATION → 400)
 *    - Fallback: 500 Internal Server Error
 * 4. Mendefinisikan endpoint /api/health untuk pengecekan status DB dan ML model.
 * 5. Mendaftarkan semua module controller di grup /api.
 * 6. Menjalankan server pada port dari env (default 3001).
 * 7. Jika clusteringEnabled=true, melatih model K-Means saat startup dan menjadwalkan
 *    retraining periodik menggunakan setInterval.
 *
 * Alur Lengkap:
 * - Startup → Load env → Validasi JWT → Buat Elysia app → Pasang CORS/Swagger →
 *   Register error handler → Register health check → Register all controllers →
 *   Listen pada port → Auto-train model (jika diaktifkan) → Siap menerima request
 *
 * Dependencies:
 * - Elysia: Web framework utama
 * - @elysiajs/cors: CORS middleware untuk mengizinkan origin tertentu
 * - @elysiajs/swagger: Dokumentasi API Swagger/OpenAPI
 * - ./config/env: Konfigurasi environment (port, JWT, LLM, S3, dll)
 * - ./common/response: Helper response (success, error, paginated)
 * - ./modules/ (semua controller): Setiap module controller untuk routing endpoint
 * - ./lib/prisma: Helper checkDbHealth untuk mengecek koneksi database
 * - ./modules/ml/trainer: Fungsi trainModels untuk K-Means clustering
 * - ./modules/ml/ml.service: Fungsi getModels untuk mengecek status model
 * - ./lib/logger: Pino logger untuk logging terstruktur
 */

import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { env } from "./config/env";
import { success, error as errorResponse } from "./common/response";
import logger from "./lib/logger";
import { authController } from "./modules/auth/auth.controller";
import { academicYearController } from "./modules/academic-years/academic-year.controller";
import { classController } from "./modules/classes/class.controller";
import { studentController } from "./modules/students/student.controller";
import { semesterRecordController } from "./modules/semester-records/semester-record.controller";
import { semesterRecordSubController } from "./modules/semester-records/semester-record.controller";
import { subjectScoreController } from "./modules/subject-scores/subject-score.controller";
import { attendanceController } from "./modules/attendance/attendance.controller";
// import { achievementController } from "./modules/achievements/achievement.controller";
// Health record route is registered via semesterRecordSubController (with requireHomeroomAccess)
// import { healthRecordController } from "./modules/health-records/health-record.controller";
import { profileController } from "./modules/profile/profile.controller";
import { bukuIndukController } from "./modules/buku-induk/buku-induk.controller";
import { dashboardController } from "./modules/dashboard/dashboard.controller";
import { aiController } from "./modules/ai/ai.controller";
import { aiSummaryController } from "./modules/ai/ai-summary.controller";
import { mlController } from "./modules/ml/ml.controller";
import { usersController } from "./modules/users/users.controller";
import { chatbotController } from "./modules/chatbot/chatbot.controller";
import { activityController } from "./modules/activity/activity.controller";
import { uploadController } from "./modules/upload/upload.controller";
import { teacherNoteController, teacherNoteUpdateController } from "./modules/teacher-notes/teacher-note.controller";
import { checkDbHealth } from "./lib/prisma";
import { trainModels } from "./modules/ml/trainer";
import { getModels } from "./modules/ml/ml.service";

// Validate critical env vars at startup — tanpa JWT_SECRET server tidak bisa jalan
if (!env.jwtSecret) {
  logger.fatal({ context: "startup" }, "JWT_SECRET is not set. Application will not start.");
  process.exit(1);
}

// Create Elysia application instance with plugins and configuration
const app = new Elysia()
  // CORS middleware — mengizinkan origin tertentu (localhost untuk dev, atau CORS_ORIGIN dari env)
  .use(cors({
    origin: (request: Request) => {
      const origin = request.headers.get("origin") || "";
      // Allow localhost origins (dev) and configured frontend URL
      if (!origin || origin.startsWith("http://localhost") || origin.startsWith("https://localhost")) return true;
      // In production, restrict to known frontend URL via CORS_ORIGIN env
      const allowed = Bun.env.CORS_ORIGIN || "";
      if (allowed && origin === allowed) return true;
      return false; // block others
    },
    credentials: true, // Izinkan cookie/auth header lintas origin
  }))
  // Swagger/OpenAPI documentation — tersedia di /docs
  .use(
    swagger({
      path: "/docs",
      documentation: {
        info: {
          title: "LSAR API",
          version: "1.0.0",
          description: "Longitudinal Student Academic Record API",
        },
      },
    })
  )
  // Global error handler — menangani semua error yang tidak tertangani di route handlers
  .onError(({ code, error: err, set }) => {
    // Route tidak ditemukan (404)
    if (code === "NOT_FOUND") {
      set.status = 404;
      return errorResponse("NOT_FOUND", "Route not found");
    }

    // Custom AppError (UnauthorizedError, ForbiddenError, NotFoundError, dll)
    // Setiap kelas error memiliki statusCode sendiri
    if (err && typeof err === "object" && "statusCode" in err) {
      const appErr = err as any;
      set.status = appErr.statusCode;
      return errorResponse(appErr.code, appErr.message);
    }

    // Prisma errors — kode error spesifik dari Prisma ORM
    if (err && typeof err === "object" && "code" in err) {
      const prismaErr = err as any;
      if (prismaErr.code === "P2002") {
        // Unique constraint violation — duplicate entry
        set.status = 409;
        return errorResponse("CONFLICT", "Duplicate entry");
      }
      if (prismaErr.code === "P2025") {
        // Record not found — operasi update/delete pada record yang tidak ada
        set.status = 404;
        return errorResponse("NOT_FOUND", "Record not found");
      }
      if (prismaErr.code === "P2003") {
        // Foreign key constraint violation
        set.status = 400;
        return errorResponse("VALIDATION_ERROR", "Referenced record not found");
      }
    }

    // Validation error dari Elysia — request body/params tidak valid
    if (code === "VALIDATION") {
      set.status = 400;
      return errorResponse("VALIDATION_ERROR", (err as any)?.message || "Validation failed");
    }

    // Fallback untuk error yang tidak dikenal
    logger.error({ err, code }, "Unhandled error in global error handler");
    set.status = 500;
    return errorResponse("INTERNAL_ERROR", "Internal server error");
  })
  // Health check endpoint — digunakan untuk monitoring status server dan database
  .get("/api/health", async () => {
    // Jalankan pengecekan DB dan status ML model secara paralel
    const [db, mlModels] = await Promise.all([
      checkDbHealth(), // Cek koneksi database
      getModels().catch(() => ({ trainedAt: null, hasClusterModel: false, meta: null })), // Gagal ambil model → null
    ]);
    const allOk = db.ok; // Status keseluruhan berdasarkan kesehatan DB
    const statusText = allOk ? "ok" : "degraded";
    logger.info({ dbOk: db.ok, mlTrained: mlModels.trainedAt !== null }, `Health check: ${statusText}`);
    return success({
      status: statusText,
      timestamp: new Date().toISOString(),
      database: db,
      analytics: {
        trained: mlModels.trainedAt !== null,
        hasClusterModel: mlModels.hasClusterModel,
        trainedAt: mlModels.trainedAt?.toISOString() || null,
      },
    });
  })
  // Routes
  .group("/api", (app) =>
    app
      .use(authController)
      .use(academicYearController)
      .use(classController)
      .use(studentController)
      .use(semesterRecordController)
      .use(semesterRecordSubController)
      .use(subjectScoreController)
      .use(attendanceController)
      // .use(achievementController)
      // .use(healthRecordController) // Registered via semesterRecordSubController with homeroom guard
      .use(activityController)
      .use(profileController)
      .use(bukuIndukController)
      .use(dashboardController)
      .use(aiController)
      .use(aiSummaryController)
      .use(mlController)
      .use(usersController)
      .use(uploadController)
      .use(chatbotController)
      .use(teacherNoteController)
      .use(teacherNoteUpdateController)
  )
  // Start server pada port dari konfigurasi environment
  .listen(env.port);

logger.info({ port: env.port }, `LSAR API running at http://localhost:${env.port}`);
logger.info({ docsUrl: `http://localhost:${env.port}/docs` }, `API docs available`);

// Auto-train K-Means clustering model on startup
// K-Means clustering — satu-satunya model yang beneran di-train (unsupervised learning)
if (env.clusteringEnabled) {
  // Training awal saat startup
  trainModels().then((m) => {
    if (m.trainedAt) {
      logger.info({ trainedAt: m.trainedAt.toISOString() }, "K-Means clustering model ready");
    } else {
      logger.warn({}, "Analytics model not trained — insufficient data");
    }
  }).catch((err: any) => {
    logger.warn({ err }, "Analytics model initial training failed");
  });

  // Periodic retraining berdasarkan interval dari env (default 6 jam)
  const intervalMs = env.clusterRetrainIntervalMs;
  logger.info({ intervalMs }, "Scheduled K-Means retraining enabled");
  setInterval(async () => {
    logger.info({ timestamp: new Date().toISOString() }, "Scheduled K-Means retraining started");
    try {
      const result = await trainModels();
      if (result.trainedAt) {
        logger.info({
          trainedAt: result.trainedAt.toISOString(),
          iterations: result.meta?.kmeansIterations,
          inertia: result.meta?.kmeansInertia,
        }, "K-Means retrained successfully");
      }
    } catch (err: any) {
      logger.error({ err }, "Analytics scheduled retraining failed");
    }
  }, intervalMs);
}
