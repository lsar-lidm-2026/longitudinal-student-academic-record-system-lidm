/**
 * ml.controller.ts
 * 
 * Cara kerja file ini:
 * - Mendefinisikan route handler (controller) untuk semua endpoint ML (machine learning)
 *   di bawah prefix `/api/ml`.
 * - Menggunakan Elysia routing chain dengan `.guard()` untuk menerapkan middleware
 *   autentikasi dan otorisasi per grup endpoint.
 * - Setiap handler memanggil fungsi dari `ml.service.ts`, lalu membungkus hasilnya
 *   dengan helper `success()` dari `common/response`.
 * 
 * Alur lengkap:
 * 1. Elysia app dibuat dengan prefix `/ml` → semua route otomatis di bawah `/api/ml`.
 * 2. Guard pertama (requireAuth) → endpoint publik-autentikasi:
 *    - GET /models → daftar model ML yang tersedia.
 *    - GET /outcomes → hasil prediksi/outcome ML.
 *    - POST /train → retrain semua model (khusus ADMINISTRATOR).
 *    - GET /eval → evaluasi performa semua model (khusus ADMINISTRATOR).
 * 3. Guard kedua (requireAuth + requireHomeroomAccess) → endpoint guru wali kelas:
 *    - GET /risk/student/:id → risk assessment per siswa.
 *    - GET /trend/student/:id → trend akademik per siswa.
 * 4. Guard ketiga (requireAuth saja) → endpoint yang bisa diakses role mana pun:
 *    - GET /risk/class/:id → risk aggregation per kelas.
 *    - GET /cluster/class/:id → clustering siswa per kelas.
 * 5. Semua error handling diserahkan ke Elysia default error handler + service layer.
 */

import { Elysia } from "elysia";
import * as mlService from "./ml.service";
import { success } from "../../common/response";
import { requireAuth } from "../../middleware/auth";
import { requireHomeroomAccess } from "../../middleware/homeroom";
import { checkRole } from "../../middleware/role";
import logger from "../../lib/logger";

/** Controller ML — menggabungkan semua route ML dalam satu Elysia instance. */
export const mlController = new Elysia({ prefix: "/ml" })
  // ── Guard 1: Endpoint yang membutuhkan autentikasi dasar ──
  .guard({}, (app) =>
    app
      .use(requireAuth)

      // GET /models — Mendapatkan daftar model ML yang tersedia
      .get("/models", async () => {
        logger.info({}, "GET /ml/models called");
        const data = await mlService.getModels();
        logger.info({ modelCount: Array.isArray(data) ? data.length : undefined }, "GET /ml/models completed");
        return success(data);
      })

      // GET /outcomes — Mendapatkan outcomes/prediksi ML (opsional filter studentId)
      .get("/outcomes", async ({ query, user }) => {
        logger.info({ query }, "GET /ml/outcomes called");
        // Hanya ADMINISTRATOR, GURU, atau KEPALA_SEKOLAH yang boleh mengakses
        checkRole(user, "ADMINISTRATOR", "GURU", "KEPALA_SEKOLAH");
        // Parameter opsional: studentId untuk filter per siswa
        const data = await mlService.getOutcomes(query.studentId as string | undefined);
        logger.info({ studentId: query.studentId }, "GET /ml/outcomes completed");
        return success(data);
      })

      // POST /train — Memicu retraining semua model (khusus ADMINISTRATOR)
      .post("/train", async ({ user }) => {
        logger.info({ userId: user?.userId }, "POST /ml/train called");
        // Hanya ADMINISTRATOR yang boleh memicu training
        checkRole(user, "ADMINISTRATOR");
        const data = await mlService.retrainModels();
        const response = {
          trainedAt: data.trainedAt,
          status: "success" as const,
          models: {
            hasClusterModel: data.clusterModel !== null,
          },
        };
        logger.info(
          { trainedAt: data.trainedAt, hasClusterModel: data.clusterModel !== null },
          "POST /ml/train completed"
        );
        return success(response);
      })

      // GET /eval — Evaluasi performa semua model (khusus ADMINISTRATOR)
      .get("/eval", async ({ user }) => {
        logger.info({ userId: user?.userId }, "GET /ml/eval called");
        // Hanya ADMINISTRATOR yang boleh melihat evaluasi model
        checkRole(user, "ADMINISTRATOR");
        const data = await mlService.evaluateAllModels();
        logger.info({}, "GET /ml/eval completed");
        return success(data);
      })
  )

  // ── Guard 2: Endpoint dengan homeroom access (guru wali kelas) ──
  .guard({}, (app) =>
    app
      .use(requireAuth)
      .use(requireHomeroomAccess)

      // GET /risk/student/:id — Risk assessment untuk satu siswa
      .get("/risk/student/:id", async ({ params }) => {
        logger.info({ studentId: params.id }, "GET /ml/risk/student/:id called");
        const data = await mlService.getStudentRisk(params.id);
        logger.info({ studentId: params.id }, "GET /ml/risk/student/:id completed");
        return success(data);
      })

      // GET /trend/student/:id — Trend akademik untuk satu siswa
      .get("/trend/student/:id", async ({ params }) => {
        logger.info({ studentId: params.id }, "GET /ml/trend/student/:id called");
        const data = await mlService.getStudentTrend(params.id);
        logger.info({ studentId: params.id }, "GET /ml/trend/student/:id completed");
        return success(data);
      })
  )

  // ── Guard 3: Endpoint untuk akses umum terautentikasi (ADMIN, GURU, KEPSEK) ──
  .guard({}, (app) =>
    app
      .use(requireAuth)

      // GET /risk/class/:id — Agregasi risk assessment untuk satu kelas
      .get("/risk/class/:id", async ({ params, user }) => {
        logger.info({ classId: params.id }, "GET /ml/risk/class/:id called");
        checkRole(user, "ADMINISTRATOR", "GURU", "KEPALA_SEKOLAH");
        const data = await mlService.getClassRisk(params.id);
        logger.info({ classId: params.id }, "GET /ml/risk/class/:id completed");
        return success(data);
      })

      // GET /cluster/class/:id — Clustering siswa dalam satu kelas
      .get("/cluster/class/:id", async ({ params, user }) => {
        logger.info({ classId: params.id }, "GET /ml/cluster/class/:id called");
        checkRole(user, "ADMINISTRATOR", "GURU", "KEPALA_SEKOLAH");
        const data = await mlService.getClassCluster(params.id);
        logger.info({ classId: params.id }, "GET /ml/cluster/class/:id completed");
        return success(data);
      })
  );
