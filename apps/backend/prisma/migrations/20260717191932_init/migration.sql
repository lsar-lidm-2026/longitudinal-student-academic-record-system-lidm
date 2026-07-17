/*
  Warnings:

  - You are about to drop the `db_academic_year` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `db_achievement` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `db_ai_summary` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `db_attendance` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `db_class` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `db_class_audit_log` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `db_health_record` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `db_semester_record` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `db_student` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `db_subject_score` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `db_user` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `db_achievement` DROP FOREIGN KEY `db_achievement_semesterRecordId_fkey`;

-- DropForeignKey
ALTER TABLE `db_ai_summary` DROP FOREIGN KEY `db_ai_summary_semesterRecordId_fkey`;

-- DropForeignKey
ALTER TABLE `db_attendance` DROP FOREIGN KEY `db_attendance_semesterRecordId_fkey`;

-- DropForeignKey
ALTER TABLE `db_class` DROP FOREIGN KEY `db_class_academicYearId_fkey`;

-- DropForeignKey
ALTER TABLE `db_class` DROP FOREIGN KEY `db_class_homeroomTeacherId_fkey`;

-- DropForeignKey
ALTER TABLE `db_class_audit_log` DROP FOREIGN KEY `db_class_audit_log_changedById_fkey`;

-- DropForeignKey
ALTER TABLE `db_class_audit_log` DROP FOREIGN KEY `db_class_audit_log_classId_fkey`;

-- DropForeignKey
ALTER TABLE `db_health_record` DROP FOREIGN KEY `db_health_record_semesterRecordId_fkey`;

-- DropForeignKey
ALTER TABLE `db_semester_record` DROP FOREIGN KEY `db_semester_record_academicYearId_fkey`;

-- DropForeignKey
ALTER TABLE `db_semester_record` DROP FOREIGN KEY `db_semester_record_createdById_fkey`;

-- DropForeignKey
ALTER TABLE `db_semester_record` DROP FOREIGN KEY `db_semester_record_studentId_fkey`;

-- DropForeignKey
ALTER TABLE `db_student` DROP FOREIGN KEY `db_student_classId_fkey`;

-- DropForeignKey
ALTER TABLE `db_subject_score` DROP FOREIGN KEY `db_subject_score_semesterRecordId_fkey`;

-- DropTable
DROP TABLE `db_academic_year`;

-- DropTable
DROP TABLE `db_achievement`;

-- DropTable
DROP TABLE `db_ai_summary`;

-- DropTable
DROP TABLE `db_attendance`;

-- DropTable
DROP TABLE `db_class`;

-- DropTable
DROP TABLE `db_class_audit_log`;

-- DropTable
DROP TABLE `db_health_record`;

-- DropTable
DROP TABLE `db_semester_record`;

-- DropTable
DROP TABLE `db_student`;

-- DropTable
DROP TABLE `db_subject_score`;

-- DropTable
DROP TABLE `db_user`;

-- CreateTable
CREATE TABLE `user` (
    `id` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMINISTRATOR', 'OPERATOR_SEKOLAH', 'GURU', 'KEPALA_SEKOLAH') NOT NULL DEFAULT 'GURU',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `user_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `academic_year` (
    `id` VARCHAR(191) NOT NULL,
    `year` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT false,
    `isArchived` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `academic_year_year_key`(`year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `class` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `academicYearId` VARCHAR(191) NOT NULL,
    `homeroomTeacherId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `class_name_academicYearId_key`(`name`, `academicYearId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `class_audit_log` (
    `id` VARCHAR(191) NOT NULL,
    `classId` VARCHAR(191) NOT NULL,
    `previousTeacherId` VARCHAR(191) NULL,
    `newTeacherId` VARCHAR(191) NULL,
    `changedById` VARCHAR(191) NOT NULL,
    `changedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `student` (
    `id` VARCHAR(191) NOT NULL,
    `nis` VARCHAR(191) NOT NULL,
    `nisn` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `gender` VARCHAR(191) NOT NULL,
    `classId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `student_nis_key`(`nis`),
    UNIQUE INDEX `student_nisn_key`(`nisn`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `semester_record` (
    `id` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `academicYearId` VARCHAR(191) NOT NULL,
    `semester` INTEGER NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `semester_record_studentId_academicYearId_semester_key`(`studentId`, `academicYearId`, `semester`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subject_score` (
    `id` VARCHAR(191) NOT NULL,
    `semesterRecordId` VARCHAR(191) NOT NULL,
    `subjectName` VARCHAR(191) NOT NULL,
    `knowledgeScore` DOUBLE NOT NULL,
    `skillsScore` DOUBLE NOT NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `subject_score_semesterRecordId_subjectName_key`(`semesterRecordId`, `subjectName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance` (
    `id` VARCHAR(191) NOT NULL,
    `semesterRecordId` VARCHAR(191) NOT NULL,
    `sick` INTEGER NOT NULL DEFAULT 0,
    `permission` INTEGER NOT NULL DEFAULT 0,
    `absent` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `attendance_semesterRecordId_key`(`semesterRecordId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `achievement` (
    `id` VARCHAR(191) NOT NULL,
    `semesterRecordId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `health_record` (
    `id` VARCHAR(191) NOT NULL,
    `semesterRecordId` VARCHAR(191) NOT NULL,
    `height` DOUBLE NULL,
    `weight` DOUBLE NULL,
    `hearingCondition` VARCHAR(191) NULL,
    `visionCondition` VARCHAR(191) NULL,
    `teethCondition` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `health_record_semesterRecordId_key`(`semesterRecordId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_summary` (
    `id` VARCHAR(191) NOT NULL,
    `semesterRecordId` VARCHAR(191) NOT NULL,
    `summaryType` ENUM('STUDENT_SUMMARY', 'DRAFT_DESCRIPTION', 'TRANSITION_SUMMARY') NOT NULL,
    `content` TEXT NOT NULL,
    `isFinal` BOOLEAN NOT NULL DEFAULT false,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ai_summary_semesterRecordId_summaryType_version_key`(`semesterRecordId`, `summaryType`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `class` ADD CONSTRAINT `class_academicYearId_fkey` FOREIGN KEY (`academicYearId`) REFERENCES `academic_year`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `class` ADD CONSTRAINT `class_homeroomTeacherId_fkey` FOREIGN KEY (`homeroomTeacherId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `class_audit_log` ADD CONSTRAINT `class_audit_log_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `class`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `class_audit_log` ADD CONSTRAINT `class_audit_log_changedById_fkey` FOREIGN KEY (`changedById`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student` ADD CONSTRAINT `student_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `class`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `semester_record` ADD CONSTRAINT `semester_record_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `student`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `semester_record` ADD CONSTRAINT `semester_record_academicYearId_fkey` FOREIGN KEY (`academicYearId`) REFERENCES `academic_year`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `semester_record` ADD CONSTRAINT `semester_record_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subject_score` ADD CONSTRAINT `subject_score_semesterRecordId_fkey` FOREIGN KEY (`semesterRecordId`) REFERENCES `semester_record`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance` ADD CONSTRAINT `attendance_semesterRecordId_fkey` FOREIGN KEY (`semesterRecordId`) REFERENCES `semester_record`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `achievement` ADD CONSTRAINT `achievement_semesterRecordId_fkey` FOREIGN KEY (`semesterRecordId`) REFERENCES `semester_record`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `health_record` ADD CONSTRAINT `health_record_semesterRecordId_fkey` FOREIGN KEY (`semesterRecordId`) REFERENCES `semester_record`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_summary` ADD CONSTRAINT `ai_summary_semesterRecordId_fkey` FOREIGN KEY (`semesterRecordId`) REFERENCES `semester_record`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
