import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { env } from "./config/env";
import { error as errorResponse } from "./common/response";
import { authController } from "./modules/auth/auth.controller";
import { academicYearController } from "./modules/academic-years/academic-year.controller";
import { classController } from "./modules/classes/class.controller";
import { studentController } from "./modules/students/student.controller";
import { semesterRecordController } from "./modules/semester-records/semester-record.controller";
import { subjectScoreController } from "./modules/subject-scores/subject-score.controller";
import { attendanceController } from "./modules/attendance/attendance.controller";
import { achievementController } from "./modules/achievements/achievement.controller";
import { healthRecordController } from "./modules/health-records/health-record.controller";
import { profileController } from "./modules/profile/profile.controller";
import { bukuIndukController } from "./modules/buku-induk/buku-induk.controller";
import { dashboardController } from "./modules/dashboard/dashboard.controller";
import { aiController } from "./modules/ai/ai.controller";
import { aiSummaryController } from "./modules/ai/ai-summary.controller";

const app = new Elysia()
  .use(cors())
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
  // Global error handler
  .onError(({ code, error: err, set }) => {
    if (code === "NOT_FOUND") {
      set.status = 404;
      return errorResponse("NOT_FOUND", "Route not found");
    }

    if (err && typeof err === "object" && "statusCode" in err) {
      const appErr = err as any;
      set.status = appErr.statusCode;
      return errorResponse(appErr.code, appErr.message);
    }

    // Prisma errors
    if (err && typeof err === "object" && "code" in err) {
      const prismaErr = err as any;
      if (prismaErr.code === "P2002") {
        set.status = 409;
        return errorResponse("CONFLICT", "Duplicate entry");
      }
      if (prismaErr.code === "P2025") {
        set.status = 404;
        return errorResponse("NOT_FOUND", "Record not found");
      }
      if (prismaErr.code === "P2003") {
        set.status = 400;
        return errorResponse("VALIDATION_ERROR", "Referenced record not found");
      }
    }

    // Validation error from Elysia
    if (code === "VALIDATION") {
      set.status = 400;
      return errorResponse("VALIDATION_ERROR", (err as any)?.message || "Validation failed");
    }

    console.error("Unhandled error:", err);
    set.status = 500;
    return errorResponse("INTERNAL_ERROR", "Internal server error");
  })
  // Health check
  .get("/api/health", () => ({
    success: true,
    data: { status: "ok", timestamp: new Date().toISOString() },
  }))
  // Routes
  .group("/api", (app) =>
    app
      .use(authController)
      .use(academicYearController)
      .use(classController)
      .use(studentController)
      .use(semesterRecordController)
      .use(subjectScoreController)
      .use(attendanceController)
      .use(achievementController)
      .use(healthRecordController)
      .use(profileController)
      .use(bukuIndukController)
      .use(dashboardController)
      .use(aiController)
      .use(aiSummaryController)
  )
  .listen(env.port);

console.log(`🦊 LSAR API running at http://localhost:${env.port}`);
console.log(`📚 API docs at http://localhost:${env.port}/docs`);
