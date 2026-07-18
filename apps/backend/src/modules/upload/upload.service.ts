/**
 * Upload Service — handles file uploads to S3 and database updates.
 */
import { prisma } from "../../lib/prisma";
import { uploadToS3, deleteFromS3 } from "../../lib/s3";
import { NotFoundError } from "../../common/error";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_DOC_TYPES = [
  "image/jpeg", "image/png", "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export interface UploadedFileInfo {
  url: string;
  key: string;
  mimeType: string;
  fileSize: number;
}

function validateFile(file: File, allowedTypes: string[]): void {
  if (!allowedTypes.includes(file.type)) {
    throw new Error(
      `Tipe file ${file.type || "tidak dikenal"} tidak diizinkan. Tipe yang diizinkan: ${allowedTypes.join(", ")}`
    );
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File terlalu besar (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`);
  }
}

/**
 * Upload foto siswa.
 */
export async function uploadStudentPhoto(
  studentId: string,
  file: File
): Promise<UploadedFileInfo> {
  validateFile(file, ALLOWED_IMAGE_TYPES);

  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) throw new NotFoundError("Siswa tidak ditemukan");

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.name.split(".").pop() || "jpg";
  const result = await uploadToS3(buffer, `photo-${studentId}.${ext}`, file.type, `students/${studentId}`);

  // Hapus foto lama kalau ada
  if (student.photoUrl) {
    const oldKey = extractKeyFromUrl(student.photoUrl);
    if (oldKey) deleteFromS3(oldKey).catch(() => {});
  }

  await prisma.student.update({
    where: { id: studentId },
    data: { photoUrl: result.url },
  });

  return { url: result.url, key: result.key, mimeType: file.type, fileSize: file.size };
}

/**
 * Upload lampiran prestasi.
 */
export async function uploadAchievementAttachment(
  achievementId: string,
  file: File
): Promise<UploadedFileInfo> {
  validateFile(file, ALLOWED_DOC_TYPES);

  const achievement = await prisma.achievement.findUnique({ where: { id: achievementId } });
  if (!achievement) throw new NotFoundError("Prestasi tidak ditemukan");

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.name.split(".").pop() || "pdf";
  const result = await uploadToS3(buffer, `achievement-${achievementId}.${ext}`, file.type, "achievements");

  // Hapus lampiran lama
  if (achievement.attachmentUrl) {
    const oldKey = extractKeyFromUrl(achievement.attachmentUrl);
    if (oldKey) deleteFromS3(oldKey).catch(() => {});
  }

  await prisma.achievement.update({
    where: { id: achievementId },
    data: { attachmentUrl: result.url },
  });

  return { url: result.url, key: result.key, mimeType: file.type, fileSize: file.size };
}

/**
 * Upload dokumen siswa (akte, KK, dll).
 */
export async function uploadStudentDocument(
  studentId: string,
  file: File,
  documentName: string
): Promise<UploadedFileInfo> {
  validateFile(file, ALLOWED_DOC_TYPES);

  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) throw new NotFoundError("Siswa tidak ditemukan");

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.name.split(".").pop() || "pdf";
  const safeName = documentName.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
  const result = await uploadToS3(
    buffer,
    `${safeName}-${Date.now()}.${ext}`,
    file.type,
    `students/${studentId}/documents`
  );

  await prisma.studentDocument.create({
    data: {
      studentId,
      name: documentName,
      fileUrl: result.url,
      mimeType: file.type,
      fileSize: file.size,
    },
  });

  return { url: result.url, key: result.key, mimeType: file.type, fileSize: file.size };
}

/**
 * Hapus file S3 berdasarkan key.
 */
export async function deleteS3File(key: string): Promise<void> {
  await deleteFromS3(key);
}

/**
 * Hapus dokumen siswa.
 */
export async function deleteStudentDocument(documentId: string): Promise<void> {
  const doc = await prisma.studentDocument.findUnique({ where: { id: documentId } });
  if (!doc) throw new NotFoundError("Dokumen tidak ditemukan");

  const key = extractKeyFromUrl(doc.fileUrl);
  if (key) await deleteFromS3(key).catch(() => {});

  await prisma.studentDocument.delete({ where: { id: documentId } });
}

function extractKeyFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    // Key is the path after /bucket/
    const parts = u.pathname.split("/");
    // Remove empty first part and bucket name
    parts.shift(); // empty
    parts.shift(); // bucket name
    return parts.join("/");
  } catch {
    return null;
  }
}
