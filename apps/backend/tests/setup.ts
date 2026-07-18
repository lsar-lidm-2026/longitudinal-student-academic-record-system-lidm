import { prisma } from "../src/lib/prisma";

let _counter = 0;
export function uid(prefix = "T"): string {
  return `${prefix}-${++_counter}-${Bun.nanoseconds()}`;
}

export async function cleanDb() {
  // Use TRUNCATE with CASCADE — handles FK constraints atomically
  try {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE
      "predicted_outcome", "ml_model", "ai_summary", "health_record",
      "achievement", "attendance", "subject_score", "semester_record",
      "class_audit_log", "student", "class", "academic_year", "user"
    CASCADE`);
  } catch {}
  try {
    const { resetCache } = await import("../src/modules/ml/trainer");
    if (typeof resetCache === "function") resetCache();
  } catch {}
}

export { prisma };
