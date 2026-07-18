import { prisma } from "../src/lib/prisma";

let _counter = 0;
let schemaEnsured = false;

async function ensureTestSchema() {
  if (schemaEnsured) return;
  schemaEnsured = true;

  await prisma.$executeRawUnsafe(`ALTER TABLE student DROP COLUMN IF EXISTS photourl`);
  await prisma.$executeRawUnsafe(`ALTER TABLE achievement DROP COLUMN IF EXISTS attachmenturl`);
  await prisma.$executeRawUnsafe(`ALTER TABLE student ADD COLUMN IF NOT EXISTS "photoUrl" VARCHAR(191) NULL`);
  await prisma.$executeRawUnsafe(`ALTER TABLE achievement ADD COLUMN IF NOT EXISTS "attachmentUrl" VARCHAR(191) NULL`);

  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS student_document CASCADE`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE student_document (
      id VARCHAR(191) NOT NULL,
      "studentId" VARCHAR(191) NOT NULL,
      name VARCHAR(191) NOT NULL,
      "fileUrl" VARCHAR(191) NOT NULL,
      "mimeType" VARCHAR(191) NOT NULL,
      "fileSize" INTEGER NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      CONSTRAINT student_document_studentId_fkey FOREIGN KEY ("studentId") REFERENCES student(id) ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS student_document_studentId_idx ON student_document ("studentId")`);
  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS predicted_outcome CASCADE`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE predicted_outcome (
      id VARCHAR(191) NOT NULL,
      "studentId" VARCHAR(191) NOT NULL,
      "academicYearId" VARCHAR(191) NULL,
      "modelType" VARCHAR(191) NOT NULL,
      score DOUBLE PRECISION NULL,
      label VARCHAR(191) NULL,
      confidence DOUBLE PRECISION NULL,
      features JSONB NULL,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      "updatedAt" TIMESTAMP(3) NOT NULL,
      PRIMARY KEY (id),
      CONSTRAINT predicted_outcome_studentId_fkey FOREIGN KEY ("studentId") REFERENCES student(id) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT predicted_outcome_academicYearId_fkey FOREIGN KEY ("academicYearId") REFERENCES academic_year(id) ON DELETE SET NULL ON UPDATE CASCADE
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS predicted_outcome_uq ON predicted_outcome ("studentId", "academicYearId", "modelType", "isActive")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS predicted_outcome_studentId_fkey ON predicted_outcome ("studentId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS predicted_outcome_academicYearId_fkey ON predicted_outcome ("academicYearId")`);
}

export function uid(prefix = "T"): string {
  return `${prefix}-${++_counter}-${Bun.nanoseconds()}`;
}

export async function cleanDb() {
  await ensureTestSchema();

  // PostgreSQL cleanup for local dev and VPS parity.
  try {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE
      "predicted_outcome", "ml_model", "ai_summary", "health_record",
      "achievement", "attendance", "subject_score", "semester_record",
      "class_audit_log", "student_document", "student", "class", "academic_year", "user"
    CASCADE`);
  } catch {}
  try {
    const { resetCache } = await import("../src/modules/ml/trainer");
    if (typeof resetCache === "function") resetCache();
  } catch {}
}

export { prisma };
