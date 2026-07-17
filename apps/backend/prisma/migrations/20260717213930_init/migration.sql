-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMINISTRATOR', 'OPERATOR_SEKOLAH', 'GURU', 'KEPALA_SEKOLAH');

-- CreateEnum
CREATE TYPE "SummaryType" AS ENUM ('STUDENT_SUMMARY', 'DRAFT_DESCRIPTION', 'TRANSITION_SUMMARY');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'GURU',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic_year" (
    "id" TEXT NOT NULL,
    "year" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_year_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "homeroomTeacherId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_audit_log" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "previousTeacherId" TEXT,
    "newTeacherId" TEXT,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student" (
    "id" TEXT NOT NULL,
    "nis" TEXT NOT NULL,
    "nisn" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "semester_record" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "semester" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "semester_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subject_score" (
    "id" TEXT NOT NULL,
    "semesterRecordId" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "knowledgeScore" DOUBLE PRECISION NOT NULL,
    "skillsScore" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subject_score_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance" (
    "id" TEXT NOT NULL,
    "semesterRecordId" TEXT NOT NULL,
    "sick" INTEGER NOT NULL DEFAULT 0,
    "permission" INTEGER NOT NULL DEFAULT 0,
    "absent" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievement" (
    "id" TEXT NOT NULL,
    "semesterRecordId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_record" (
    "id" TEXT NOT NULL,
    "semesterRecordId" TEXT NOT NULL,
    "height" DOUBLE PRECISION,
    "weight" DOUBLE PRECISION,
    "hearingCondition" TEXT,
    "visionCondition" TEXT,
    "teethCondition" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "health_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_summary" (
    "id" TEXT NOT NULL,
    "semesterRecordId" TEXT NOT NULL,
    "summaryType" "SummaryType" NOT NULL,
    "content" TEXT NOT NULL,
    "isFinal" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_summary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "user"("username");

-- CreateIndex
CREATE UNIQUE INDEX "academic_year_year_key" ON "academic_year"("year");

-- CreateIndex
CREATE UNIQUE INDEX "class_name_academicYearId_key" ON "class"("name", "academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "student_nis_key" ON "student"("nis");

-- CreateIndex
CREATE UNIQUE INDEX "student_nisn_key" ON "student"("nisn");

-- CreateIndex
CREATE UNIQUE INDEX "semester_record_studentId_academicYearId_semester_key" ON "semester_record"("studentId", "academicYearId", "semester");

-- CreateIndex
CREATE UNIQUE INDEX "subject_score_semesterRecordId_subjectName_key" ON "subject_score"("semesterRecordId", "subjectName");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_semesterRecordId_key" ON "attendance"("semesterRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "health_record_semesterRecordId_key" ON "health_record"("semesterRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_summary_semesterRecordId_summaryType_version_key" ON "ai_summary"("semesterRecordId", "summaryType", "version");

-- AddForeignKey
ALTER TABLE "class" ADD CONSTRAINT "class_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_year"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class" ADD CONSTRAINT "class_homeroomTeacherId_fkey" FOREIGN KEY ("homeroomTeacherId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_audit_log" ADD CONSTRAINT "class_audit_log_classId_fkey" FOREIGN KEY ("classId") REFERENCES "class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_audit_log" ADD CONSTRAINT "class_audit_log_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student" ADD CONSTRAINT "student_classId_fkey" FOREIGN KEY ("classId") REFERENCES "class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semester_record" ADD CONSTRAINT "semester_record_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semester_record" ADD CONSTRAINT "semester_record_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_year"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semester_record" ADD CONSTRAINT "semester_record_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_score" ADD CONSTRAINT "subject_score_semesterRecordId_fkey" FOREIGN KEY ("semesterRecordId") REFERENCES "semester_record"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_semesterRecordId_fkey" FOREIGN KEY ("semesterRecordId") REFERENCES "semester_record"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievement" ADD CONSTRAINT "achievement_semesterRecordId_fkey" FOREIGN KEY ("semesterRecordId") REFERENCES "semester_record"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_record" ADD CONSTRAINT "health_record_semesterRecordId_fkey" FOREIGN KEY ("semesterRecordId") REFERENCES "semester_record"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_summary" ADD CONSTRAINT "ai_summary_semesterRecordId_fkey" FOREIGN KEY ("semesterRecordId") REFERENCES "semester_record"("id") ON DELETE CASCADE ON UPDATE CASCADE;
