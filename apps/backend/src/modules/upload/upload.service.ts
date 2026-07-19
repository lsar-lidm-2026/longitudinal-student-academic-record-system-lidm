/**
 * Upload Service — handles file uploads to S3 and database updates.
 * ==================================================================
 *
 * Cara Kerja:
 * 1. Menerima file (tipe File) dan metadata (studentId, achievementId, dll) dari controller.
 * 2. Memvalidasi tipe file (ALLOWED_IMAGE_TYPES / ALLOWED_DOC_TYPES) dan ukuran (MAX_FILE_SIZE = 10MB).
 * 3. Mengonversi file ke Buffer untuk di-upload ke S3.
 * 4. Upload file ke S3 via helper `uploadToS3` dengan path yang terstruktur.
 * 5. Jika ada file lama (photoUrl / attachmentUrl), hapus dari S3.
 * 6. Update atau buat record di database dengan URL baru.
 * 7. Mengembalikan UploadedFileInfo { url, key, mimeType, fileSize }.
 *
 * Alur Lengkap:
 * 1. Controller menerima request, parse form-data, panggil service function.
 * 2. Service memvalidasi file → throw Error jika tidak sesuai.
 * 3. Service cek keberadaan record (student/achievement) → throw NotFoundError jika tidak ada.
 * 4. Konversi file ke Buffer → upload ke S3 dengan path tertentu.
 * 5. Hapus file lama dari S3 (jika ada dan berbeda).
 * 6. Update record di database dengan URL baru.
 * 7. Return info file yang sudah diupload.
 *
 * Fungsi:
 * - uploadStudentPhoto           — Upload foto profil siswa
 * - uploadAchievementAttachment  — Upload lampiran prestasi
 * - uploadStudentDocument        — Upload dokumen siswa (akte, KK, dll)
 * - deleteS3File                 — Hapus file dari S3 berdasarkan key
 * - deleteStudentDocument        — Hapus dokumen siswa (S3 + database)
 * - validateFile (internal)      — Validasi tipe dan ukuran file
 * - extractKeyFromUrl (internal) — Ekstrak S3 key dari URL
 */
import { prisma } from "../../lib/prisma";       // Prisma client untuk query database
import { uploadToS3, deleteFromS3 } from "../../lib/s3"; // S3 upload/delete helpers
import { NotFoundError } from "../../common/error";     // Error class untuk resource tidak ditemukan
import logger from "../../lib/logger";                   // Pino logger instance

/**
 * Daftar tipe MIME yang diizinkan untuk upload foto.
 * Hanya image: JPEG, PNG, WebP, GIF.
 */
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/**
 * Daftar tipe MIME yang diizinkan untuk upload dokumen.
 * Mencakup image, PDF, dan dokumen Word.
 */
const ALLOWED_DOC_TYPES = [
  "image/jpeg", "image/png", "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

/**
 * Batas maksimum ukuran file: 10 MB.
 */
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * UploadedFileInfo — struktur data yang dikembalikan setelah upload berhasil.
 *
 * @property url      - URL publik file di S3
 * @property key      - Key/path file di S3 bucket
 * @property mimeType - Tipe MIME file
 * @property fileSize - Ukuran file dalam bytes
 */
export interface UploadedFileInfo {
  url: string;
  key: string;
  mimeType: string;
  fileSize: number;
}

/**
 * validateFile — memvalidasi tipe MIME dan ukuran file.
 *
 * @param file         - File object dari form-data
 * @param allowedTypes - Daftar tipe MIME yang diizinkan
 * @throws Error       - Jika tipe tidak diizinkan atau ukuran melebihi batas
 */
function validateFile(file: File, allowedTypes: string[]): void {
  // Cek apakah tipe MIME file ada dalam daftar yang diizinkan
  if (!allowedTypes.includes(file.type)) {
    throw new Error(
      `Tipe file ${file.type || "tidak dikenal"} tidak diizinkan. Tipe yang diizinkan: ${allowedTypes.join(", ")}`
    );
  }
  // Cek apakah ukuran file melebihi batas maksimum
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File terlalu besar (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`);
  }
}

/**
 * uploadStudentPhoto — Upload foto profil siswa ke S3 dan update database.
 *
 * Alur:
 * 1. Validasi file (hanya image).
 * 2. Cek keberadaan siswa di database — throw NotFoundError jika tidak ada.
 * 3. Konversi file ke Buffer.
 * 4. Upload ke S3 dengan path `students/{studentId}/photo-{studentId}.{ext}`.
 * 5. Jika siswa sudah memiliki photoUrl, hapus file lama dari S3.
 * 6. Update field photoUrl di tabel Student.
 * 7. Return UploadedFileInfo.
 *
 * @param studentId - UUID siswa
 * @param file      - File object (dari form-data)
 * @returns         - UploadedFileInfo { url, key, mimeType, fileSize }
 */
export async function uploadStudentPhoto(
  studentId: string,
  file: File
): Promise<UploadedFileInfo> {
  logger.info({ studentId, fileName: file.name, fileSize: file.size }, "Upload service: starting student photo upload");
  // Validasi tipe dan ukuran file
  validateFile(file, ALLOWED_IMAGE_TYPES);

  // Cari siswa di database — pastikan record ada
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) {
    logger.warn({ studentId }, "Upload service: student not found for photo upload");
    throw new NotFoundError("Siswa tidak ditemukan");
  }

  // Konversi File Blob ke Buffer untuk S3 upload
  const buffer = Buffer.from(await file.arrayBuffer());
  // Ekstrak ekstensi file dari nama asli, fallback ke "jpg"
  const ext = file.name.split(".").pop() || "jpg";
  // Upload ke S3 dengan key: students/{studentId}/photo-{studentId}.{ext}
  const result = await uploadToS3(buffer, `photo-${studentId}.${ext}`, file.type, `students/${studentId}`);
  logger.info({ studentId, key: result.key, url: result.url }, "Upload service: student photo uploaded to S3");

  // Hapus foto lama kalau ada (cleanup)
  if (student.photoUrl) {
    logger.debug({ studentId, oldPhotoUrl: student.photoUrl }, "Upload service: deleting old student photo from S3");
    const oldKey = extractKeyFromUrl(student.photoUrl);
    if (oldKey) deleteFromS3(oldKey).catch(() => {}); // Fire-and-forget — tidak kritikal jika gagal
  }

  // Update database dengan URL foto yang baru
  await prisma.student.update({
    where: { id: studentId },
    data: { photoUrl: result.url },
  });
  logger.info({ studentId, url: result.url }, "Upload service: student database updated with new photo URL");

  return { url: result.url, key: result.key, mimeType: file.type, fileSize: file.size };
}

/**
 * uploadAchievementAttachment — Upload lampiran prestasi ke S3.
 *
 * Alur:
 * 1. Validasi file (dokumen/image).
 * 2. Cek keberadaan achievement — throw NotFoundError jika tidak ada.
 * 3. Konversi file ke Buffer.
 * 4. Upload ke S3 dengan path `achievements/achievement-{achievementId}.{ext}`.
 * 5. Jika achievement sudah memiliki attachmentUrl, hapus file lama.
 * 6. Update field attachmentUrl di tabel Achievement.
 * 7. Return UploadedFileInfo.
 *
 * @param achievementId - UUID achievement
 * @param file          - File object (dari form-data)
 * @returns             - UploadedFileInfo { url, key, mimeType, fileSize }
 */
export async function uploadAchievementAttachment(
  achievementId: string,
  file: File
): Promise<UploadedFileInfo> {
  logger.info({ achievementId, fileName: file.name, fileSize: file.size }, "Upload service: starting achievement attachment upload");
  // Validasi tipe dan ukuran file
  validateFile(file, ALLOWED_DOC_TYPES);

  // Cari achievement di database — pastikan record ada
  const achievement = await prisma.achievement.findUnique({ where: { id: achievementId } });
  if (!achievement) {
    logger.warn({ achievementId }, "Upload service: achievement not found");
    throw new NotFoundError("Prestasi tidak ditemukan");
  }

  // Konversi File Blob ke Buffer untuk S3 upload
  const buffer = Buffer.from(await file.arrayBuffer());
  // Ekstrak ekstensi file dari nama asli, fallback ke "pdf"
  const ext = file.name.split(".").pop() || "pdf";
  // Upload ke S3 dengan key: achievements/achievement-{achievementId}.{ext}
  const result = await uploadToS3(buffer, `achievement-${achievementId}.${ext}`, file.type, "achievements");
  logger.info({ achievementId, key: result.key, url: result.url }, "Upload service: achievement attachment uploaded to S3");

  // Hapus lampiran lama jika ada (cleanup)
  if (achievement.attachmentUrl) {
    logger.debug({ achievementId, oldAttachmentUrl: achievement.attachmentUrl }, "Upload service: deleting old achievement attachment from S3");
    const oldKey = extractKeyFromUrl(achievement.attachmentUrl);
    if (oldKey) deleteFromS3(oldKey).catch(() => {}); // Fire-and-forget
  }

  // Update database dengan URL attachment yang baru
  await prisma.achievement.update({
    where: { id: achievementId },
    data: { attachmentUrl: result.url },
  });
  logger.info({ achievementId, url: result.url }, "Upload service: achievement database updated with new attachment URL");

  return { url: result.url, key: result.key, mimeType: file.type, fileSize: file.size };
}

/**
 * uploadStudentDocument — Upload dokumen siswa (akte, KK, dll) ke S3.
 *
 * Berbeda dengan uploadStudentPhoto, fungsi ini:
 * - Menyimpan multiple dokumen per siswa (tidak overwrite).
 * - Menyimpan record di tabel StudentDocument (terpisah dari Student).
 * - Menggunakan nama yang di-sanitasi untuk S3 key.
 *
 * Alur:
 * 1. Validasi file (dokumen/image).
 * 2. Cek keberadaan siswa — throw NotFoundError jika tidak ada.
 * 3. Konversi file ke Buffer.
 * 4. Sanitasi nama dokumen untuk S3 key.
 * 5. Upload ke S3 dengan path `students/{studentId}/documents/{safeName}-{timestamp}.{ext}`.
 * 6. Buat record baru di tabel StudentDocument.
 * 7. Return UploadedFileInfo.
 *
 * @param studentId    - UUID siswa
 * @param file         - File object (dari form-data)
 * @param documentName - Nama dokumen (misal: "Akte Kelahiran")
 * @returns            - UploadedFileInfo { url, key, mimeType, fileSize }
 */
export async function uploadStudentDocument(
  studentId: string,
  file: File,
  documentName: string
): Promise<UploadedFileInfo> {
  logger.info({ studentId, documentName, fileName: file.name, fileSize: file.size }, "Upload service: starting student document upload");
  // Validasi tipe dan ukuran file
  validateFile(file, ALLOWED_DOC_TYPES);

  // Cari siswa di database — pastikan record ada
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) {
    logger.warn({ studentId }, "Upload service: student not found for document upload");
    throw new NotFoundError("Siswa tidak ditemukan");
  }

  // Konversi File Blob ke Buffer untuk S3 upload
  const buffer = Buffer.from(await file.arrayBuffer());
  // Ekstrak ekstensi file dari nama asli, fallback ke "pdf"
  const ext = file.name.split(".").pop() || "pdf";
  // Sanitasi nama dokumen: hanya huruf/angka, lowercase, underscore sebagai separator
  const safeName = documentName.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
  // Upload ke S3 dengan timestamp untuk menghindari konflik nama
  const result = await uploadToS3(
    buffer,
    `${safeName}-${Date.now()}.${ext}`,  // Contoh: akte_kelahiran-1712345678901.pdf
    file.type,
    `students/${studentId}/documents`
  );
  logger.info({ studentId, documentName, key: result.key, url: result.url }, "Upload service: student document uploaded to S3");

  // Simpan record dokumen di database (tabel StudentDocument)
  await prisma.studentDocument.create({
    data: {
      studentId,
      name: documentName,
      fileUrl: result.url,
      mimeType: file.type,
      fileSize: file.size,
    },
  });
  logger.info({ studentId, documentName, url: result.url }, "Upload service: student document record created");

  return { url: result.url, key: result.key, mimeType: file.type, fileSize: file.size };
}

/**
 * deleteS3File — Menghapus file dari S3 berdasarkan key.
 *
 * Fungsi publik sederhana yang membungkus `deleteFromS3` dari lib/s3.
 *
 * @param key - S3 key dari file yang akan dihapus
 */
export async function deleteS3File(key: string): Promise<void> {
  logger.info({ s3Key: key }, "Upload service: deleting S3 file by key");
  await deleteFromS3(key);
  logger.info({ s3Key: key }, "Upload service: S3 file deleted");
}

/**
 * deleteStudentDocument — Menghapus dokumen siswa dari S3 dan database.
 *
 * Alur:
 * 1. Cari StudentDocument berdasarkan ID — throw NotFoundError jika tidak ada.
 * 2. Ekstrak S3 key dari fileUrl.
 * 3. Hapus file dari S3 (fire-and-forget).
 * 4. Hapus record dari tabel StudentDocument.
 *
 * @param documentId - UUID StudentDocument
 */
export async function deleteStudentDocument(documentId: string): Promise<void> {
  logger.info({ documentId }, "Upload service: starting student document deletion");
  // Cari dokumen di database — pastikan record ada
  const doc = await prisma.studentDocument.findUnique({ where: { id: documentId } });
  if (!doc) {
    logger.warn({ documentId }, "Upload service: document not found for deletion");
    throw new NotFoundError("Dokumen tidak ditemukan");
  }

  // Ekstrak S3 key dari URL untuk dihapus
  const key = extractKeyFromUrl(doc.fileUrl);
  if (key) {
    logger.debug({ documentId, s3Key: key }, "Upload service: deleting document from S3");
    await deleteFromS3(key).catch(() => {}); // Fire-and-forget
  }

  // Hapus record dari database
  await prisma.studentDocument.delete({ where: { id: documentId } });
  logger.info({ documentId }, "Upload service: student document deleted successfully");
}

/**
 * extractKeyFromUrl — Mengekstrak S3 key dari URL lengkap.
 *
 * URL S3 biasanya berbentuk: https://{bucket}.s3.{region}.amazonaws.com/{key}
 * Fungsi ini mengambil path setelah bucket name.
 *
 * Contoh:
 *   URL:  https://my-bucket.s3.ap-southeast-1.amazonaws.com/students/abc/photo.jpg
 *   Key:  students/abc/photo.jpg
 *
 * @param url - URL lengkap file di S3
 * @returns   - S3 key, atau null jika parsing gagal
 */
function extractKeyFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    // Key adalah path setelah bucket name
    const parts = u.pathname.split("/");
    // Hapus elemen pertama (kosong karena path dimulai dengan /)
    parts.shift(); // empty
    // Hapus elemen kedua (bucket name)
    parts.shift(); // bucket name
    // Sisa dari array adalah key
    return parts.join("/");
  } catch {
    // Jika URL tidak valid, return null
    return null;
  }
}
