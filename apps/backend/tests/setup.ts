import { prisma } from "../src/lib/prisma";

export async function cleanDb() {
  // Single atomic TRUNCATE with CASCADE handles FK constraints properly
  try {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "predicted_outcome", "ml_model", "ai_summary", "health_record",
        "achievement", "attendance", "subject_score", "semester_record",
        "class_audit_log", "student", "class", "academic_year", "user"
      CASCADE
    `);
  } catch {}

  // Reset ML trainer cache
  try {
    const mod = await import("../src/modules/ml/trainer");
    if (typeof mod.resetCache === "function") mod.resetCache();
  } catch {}
}

export { prisma };
