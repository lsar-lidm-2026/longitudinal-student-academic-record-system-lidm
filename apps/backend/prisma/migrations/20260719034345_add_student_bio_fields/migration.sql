-- AlterTable
ALTER TABLE "achievement" ADD COLUMN     "attachmentUrl" TEXT;

-- AlterTable
ALTER TABLE "student" ADD COLUMN     "address" TEXT,
ADD COLUMN     "birthDate" TEXT,
ADD COLUMN     "parentName" TEXT,
ADD COLUMN     "photoUrl" TEXT;

-- CreateTable
CREATE TABLE "student_document" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_document_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "student_document" ADD CONSTRAINT "student_document_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
