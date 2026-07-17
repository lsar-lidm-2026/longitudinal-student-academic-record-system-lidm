import { prisma } from "../src/lib/prisma";

export async function cleanDb() {
  const tables = [
    "ai_summary", "health_record", "achievement", "attendance",
    "subject_score", "semester_record", "student", "class_audit_log",
    "class", "academic_year", "user",
  ];
  for (const t of tables) {
    try { await prisma.$executeRawUnsafe(`DELETE FROM "${t}"`); }
    catch {}
  }
}

export { prisma };
