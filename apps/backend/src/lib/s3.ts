/**
 * S3-compatible storage client.
 * ==============================
 *
 * Cara Kerja:
 * 1. `getClient()` — Singleton pattern: membuat & caching S3Client dengan kredensial dari env.
 *    Support S3-compatible endpoints (MinIO, Wasabi, Cloudflare R2, dll) via forcePathStyle.
 * 2. `uploadToS3()` — Upload file (Buffer/Uint8Array) ke S3 bucket.
 *    - File > 5MB menggunakan multipart upload via @aws-sdk/lib-storage.
 *    - File ≤ 5MB menggunakan PutObjectCommand sederhana.
 *    - Nama file di-sanitasi (hapus karakter non-alfanumerik kecuali ._-).
 *    - Mengembalikan URL publik, key, dan bucket name.
 * 3. `downloadFromS3()` — Download file dari S3 berdasarkan key.
 *    - Handle berbagai tipe Body: Readable stream, Buffer, atau SDK transform.
 *    - Mengembalikan Buffer.
 * 4. `deleteFromS3()` — Hapus file dari S3 berdasarkan key.
 * 5. `listS3Files()` — List semua file dalam folder (prefix) tertentu.
 *
 * Alur:
 * - Semua fungsi internally memanggil getClient() untuk mendapatkan S3Client singleton.
 * - S3Client dibuat sekali saat pertama kali dipanggil (lazy initialization).
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { env } from "../config/env";
import { Readable } from "stream";
import logger from "./logger";

/** Singleton S3 client — null sebelum pertama kali diinisialisasi */
let s3Client: S3Client | null = null;

/**
 * Mendapatkan (atau membuat) S3Client singleton.
 * Lazy initialization: client dibuat saat pertama kali dipanggil.
 * @returns S3Client instance yang sudah dikonfigurasi.
 */
function getClient(): S3Client {
  if (!s3Client) {
    logger.info(
      { endpoint: env.s3Endpoint, region: env.s3Region, bucket: env.s3Bucket },
      "Initializing S3 client"
    );
    s3Client = new S3Client({
      endpoint: env.s3Endpoint,
      region: env.s3Region,
      credentials: {
        accessKeyId: env.s3AccessKey,
        secretAccessKey: env.s3SecretKey,
      },
      forcePathStyle: true, // required for MinIO / non-AWS S3-compatible
    });
  }
  return s3Client;
}

/** Hasil upload S3 — URL publik, key, dan nama bucket */
export interface S3UploadResult {
  url: string;
  key: string;
  bucket: string;
}

/**
 * Upload file ke S3 bucket.
 * Accepts Buffer, Uint8Array, atau ReadableStream (via Upload).
 * @param fileBuffer - Konten file sebagai Buffer atau Uint8Array.
 * @param fileName - Nama file asli (akan di-sanitasi untuk key).
 * @param mimeType - MIME type file (Content-Type).
 * @param folder - Folder tujuan di bucket (default: "uploads").
 * @returns S3UploadResult berisi URL publik, key, dan bucket.
 */
export async function uploadToS3(
  fileBuffer: Buffer | Uint8Array,
  fileName: string,
  mimeType: string,
  folder: string = "uploads"
): Promise<S3UploadResult> {
  const client = getClient();
  // Buat key unik dengan timestamp dan sanitasi nama file
  const key = `${folder}/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  logger.info({ key, size: fileBuffer.length, mimeType }, "Uploading file to S3");

  // Use multipart upload for files > 5MB, simple put for smaller files
  if (fileBuffer.length > 5 * 1024 * 1024) {
    logger.debug("File >5MB, using multipart upload");
    const upload = new Upload({
      client,
      params: {
        Bucket: env.s3Bucket,
        Key: key,
        Body: fileBuffer,
        ContentType: mimeType,
      },
    });
    await upload.done();
  } else {
    logger.debug("File <=5MB, using single PutObjectCommand");
    await client.send(
      new PutObjectCommand({
        Bucket: env.s3Bucket,
        Key: key,
        Body: fileBuffer,
        ContentType: mimeType,
      })
    );
  }

  // Build public URL — endpoint/bucket/key
  const url = `${env.s3Endpoint}/${env.s3Bucket}/${key}`;
  logger.info({ url, key, bucket: env.s3Bucket }, "File uploaded to S3 successfully");

  return { url, key, bucket: env.s3Bucket };
}

/**
 * Download file dari S3 — returns Buffer.
 * @param key - S3 object key dari file yang akan di-download.
 * @returns Buffer berisi konten file.
 */
export async function downloadFromS3(key: string): Promise<Buffer> {
  const client = getClient();
  logger.info({ key }, "Downloading file from S3");

  // Request object dari S3
  const response = await client.send(
    new GetObjectCommand({
      Bucket: env.s3Bucket,
      Key: key,
    })
  );

  const body = response.Body;

  // Handle Readable stream — baca chunk by chunk
  if (body instanceof Readable) {
    const chunks: Buffer[] = [];
    for await (const chunk of body) {
      chunks.push(Buffer.from(chunk));
    }
    const result = Buffer.concat(chunks);
    logger.debug({ key, size: result.length }, "Downloaded file from S3 (streaming)");
    return result;
  }

  // Handle Buffer langsung
  if (body instanceof Buffer) {
    logger.debug({ key, size: body.length }, "Downloaded file from S3 (buffer)");
    return body;
  }

  // Handle SDK v3 transform (misalnya dari S3 compatible lain)
  if (body && typeof (body as any).transformToByteArray === "function") {
    const result = Buffer.from(await (body as any).transformToByteArray());
    logger.debug({ key, size: result.length }, "Downloaded file from S3 (transform)");
    return result;
  }

  // Fallback: body null/undefined — return buffer kosong
  logger.warn({ key }, "S3 response body was empty/null, returning empty buffer");
  return Buffer.alloc(0);
}

/**
 * Hapus file dari S3 berdasarkan key.
 * @param key - S3 object key dari file yang akan dihapus.
 */
export async function deleteFromS3(key: string): Promise<void> {
  const client = getClient();
  logger.info({ key }, "Deleting file from S3");
  await client.send(
    new DeleteObjectCommand({
      Bucket: env.s3Bucket,
      Key: key,
    })
  );
  logger.info({ key }, "File deleted from S3 successfully");
}

/**
 * List semua file dalam folder (prefix) S3.
 * @param prefix - Prefix/path folder untuk filtering (misal: "uploads/").
 * @returns Array objek { key, size, lastModified }.
 */
export async function listS3Files(prefix: string): Promise<Array<{ key: string; size: number; lastModified?: Date }>> {
  const client = getClient();
  logger.info({ prefix }, "Listing S3 files");

  const response = await client.send(
    new ListObjectsV2Command({
      Bucket: env.s3Bucket,
      Prefix: prefix,
    })
  );

  const files = (response.Contents || []).map((obj) => ({
    key: obj.Key || "",
    size: obj.Size || 0,
    lastModified: obj.LastModified,
  }));

  logger.info({ prefix, count: files.length }, "S3 files listed successfully");
  return files;
}
