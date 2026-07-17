-- CreateTable
CREATE TABLE `db_user` (
    `id` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMINISTRATOR', 'OPERATOR_SEKOLAH', 'GURU', 'KEPALA_SEKOLAH') NOT NULL DEFAULT 'GURU',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `db_user_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `db_academic_year` (
    `id` VARCHAR(191) NOT NULL,
    `year` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT false,
    `isArchived` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `db_academic_year_year_key`(`year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `db_class` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `academicYearId` VARCHAR(191) NOT NULL,
    `homeroomTeacherId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `db_class_name_academicYearId_key`(`name`, `academicYearId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `db_class_audit_log` (
    `id` VARCHAR(191) NOT NULL,
    `classId` VARCHAR(191) NOT NULL,
    `previousTeacherId` VARCHAR(191) NULL,
    `newTeacherId` VARCHAR(191) NULL,
    `changedById` VARCHAR(191) NOT NULL,
    `changedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `db_student` (
    `id` VARCHAR(191) NOT NULL,
    `nis` VARCHAR(191) NOT NULL,
    `nisn` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `gender` VARCHAR(191) NOT NULL,
    `classId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `db_student_nis_key`(`nis`),
    UNIQUE INDEX `db_student_nisn_key`(`nisn`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `db_semester_record` (
    `id` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `academicYearId` VARCHAR(191) NOT NULL,
    `semester` INTEGER NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `db_semester_record_studentId_academicYearId_semester_key`(`studentId`, `academicYearId`, `semester`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `db_subject_score` (
    `id` VARCHAR(191) NOT NULL,
    `semesterRecordId` VARCHAR(191) NOT NULL,
    `subjectName` VARCHAR(191) NOT NULL,
    `knowledgeScore` DOUBLE NOT NULL,
    `skillsScore` DOUBLE NOT NULL,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `db_subject_score_semesterRecordId_subjectName_key`(`semesterRecordId`, `subjectName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `db_attendance` (
    `id` VARCHAR(191) NOT NULL,
    `semesterRecordId` VARCHAR(191) NOT NULL,
    `sick` INTEGER NOT NULL DEFAULT 0,
    `permission` INTEGER NOT NULL DEFAULT 0,
    `absent` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `db_attendance_semesterRecordId_key`(`semesterRecordId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `db_achievement` (
    `id` VARCHAR(191) NOT NULL,
    `semesterRecordId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `db_health_record` (
    `id` VARCHAR(191) NOT NULL,
    `semesterRecordId` VARCHAR(191) NOT NULL,
    `height` DOUBLE NULL,
    `weight` DOUBLE NULL,
    `hearingCondition` VARCHAR(191) NULL,
    `visionCondition` VARCHAR(191) NULL,
    `teethCondition` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `db_health_record_semesterRecordId_key`(`semesterRecordId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `db_ai_summary` (
    `id` VARCHAR(191) NOT NULL,
    `semesterRecordId` VARCHAR(191) NOT NULL,
    `summaryType` ENUM('STUDENT_SUMMARY', 'DRAFT_DESCRIPTION', 'TRANSITION_SUMMARY') NOT NULL,
    `content` VARCHAR(191) NOT NULL,
    `isFinal` BOOLEAN NOT NULL DEFAULT false,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `db_ai_summary_semesterRecordId_summaryType_version_key`(`semesterRecordId`, `summaryType`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `db_class` ADD CONSTRAINT `db_class_academicYearId_fkey` FOREIGN KEY (`academicYearId`) REFERENCES `db_academic_year`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `db_class` ADD CONSTRAINT `db_class_homeroomTeacherId_fkey` FOREIGN KEY (`homeroomTeacherId`) REFERENCES `db_user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `db_class_audit_log` ADD CONSTRAINT `db_class_audit_log_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `db_class`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `db_class_audit_log` ADD CONSTRAINT `db_class_audit_log_changedById_fkey` FOREIGN KEY (`changedById`) REFERENCES `db_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `db_student` ADD CONSTRAINT `db_student_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `db_class`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `db_semester_record` ADD CONSTRAINT `db_semester_record_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `db_student`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `db_semester_record` ADD CONSTRAINT `db_semester_record_academicYearId_fkey` FOREIGN KEY (`academicYearId`) REFERENCES `db_academic_year`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `db_semester_record` ADD CONSTRAINT `db_semester_record_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `db_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `db_subject_score` ADD CONSTRAINT `db_subject_score_semesterRecordId_fkey` FOREIGN KEY (`semesterRecordId`) REFERENCES `db_semester_record`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `db_attendance` ADD CONSTRAINT `db_attendance_semesterRecordId_fkey` FOREIGN KEY (`semesterRecordId`) REFERENCES `db_semester_record`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `db_achievement` ADD CONSTRAINT `db_achievement_semesterRecordId_fkey` FOREIGN KEY (`semesterRecordId`) REFERENCES `db_semester_record`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `db_health_record` ADD CONSTRAINT `db_health_record_semesterRecordId_fkey` FOREIGN KEY (`semesterRecordId`) REFERENCES `db_semester_record`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `db_ai_summary` ADD CONSTRAINT `db_ai_summary_semesterRecordId_fkey` FOREIGN KEY (`semesterRecordId`) REFERENCES `db_semester_record`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
