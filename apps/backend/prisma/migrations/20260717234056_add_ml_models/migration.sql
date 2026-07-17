-- CreateEnum
CREATE TYPE "ModelType" AS ENUM ('TREND_PREDICTION', 'RISK_CLASSIFICATION', 'BEHAVIOR_CLUSTER');

-- CreateTable
CREATE TABLE "predicted_outcome" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYearId" TEXT,
    "modelType" "ModelType" NOT NULL,
    "score" DOUBLE PRECISION,
    "label" TEXT,
    "confidence" DOUBLE PRECISION,
    "features" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "predicted_outcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ml_model" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "modelType" "ModelType" NOT NULL,
    "version" INTEGER NOT NULL,
    "filePath" TEXT,
    "metrics" JSONB,
    "featureList" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "trainedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ml_model_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "predicted_outcome_studentId_academicYearId_modelType_isActi_key" ON "predicted_outcome"("studentId", "academicYearId", "modelType", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ml_model_modelType_version_key" ON "ml_model"("modelType", "version");

-- AddForeignKey
ALTER TABLE "predicted_outcome" ADD CONSTRAINT "predicted_outcome_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predicted_outcome" ADD CONSTRAINT "predicted_outcome_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_year"("id") ON DELETE SET NULL ON UPDATE CASCADE;
