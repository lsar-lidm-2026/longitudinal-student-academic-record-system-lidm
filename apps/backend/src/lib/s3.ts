/**
 * S3-compatible storage client.
 * Uses AWS SDK v3 with support for S3-compatible endpoints (MinIO, Wasabi, Cloudflare R2, dll).
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

let s3Client: S3Client | null = null;

function getClient(): S3Client {
  if (!s3Client) {
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

export interface S3UploadResult {
  url: string;
  key: string;
  bucket: string;
}

/**
 * Upload file ke S3 bucket.
 * Accepts Buffer, Uint8Array, or ReadableStream.
 */
export async function uploadToS3(
  fileBuffer: Buffer | Uint8Array,
  fileName: string,
  mimeType: string,
  folder: string = "uploads"
): Promise<S3UploadResult> {
  const client = getClient();
  const key = `${folder}/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  // Use multipart upload for files > 5MB, simple put for smaller files
  if (fileBuffer.length > 5 * 1024 * 1024) {
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
    await client.send(
      new PutObjectCommand({
        Bucket: env.s3Bucket,
        Key: key,
        Body: fileBuffer,
        ContentType: mimeType,
      })
    );
  }

  // Build public URL
  const url = `${env.s3Endpoint}/${env.s3Bucket}/${key}`;

  return { url, key, bucket: env.s3Bucket };
}

/**
 * Download file dari S3 — returns Buffer.
 */
export async function downloadFromS3(key: string): Promise<Buffer> {
  const client = getClient();
  const response = await client.send(
    new GetObjectCommand({
      Bucket: env.s3Bucket,
      Key: key,
    })
  );

  const body = response.Body;
  if (body instanceof Readable) {
    const chunks: Buffer[] = [];
    for await (const chunk of body) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  if (body instanceof Buffer) return body;
  // body is neither Readable nor Buffer — use the async iterator
  if (body && typeof (body as any).transformToByteArray === "function") {
    return Buffer.from(await (body as any).transformToByteArray());
  }
  return Buffer.alloc(0);
}

/**
 * Hapus file dari S3.
 */
export async function deleteFromS3(key: string): Promise<void> {
  const client = getClient();
  await client.send(
    new DeleteObjectCommand({
      Bucket: env.s3Bucket,
      Key: key,
    })
  );
}

/**
 * List semua file dalam folder S3.
 */
export async function listS3Files(prefix: string): Promise<Array<{ key: string; size: number; lastModified?: Date }>> {
  const client = getClient();
  const response = await client.send(
    new ListObjectsV2Command({
      Bucket: env.s3Bucket,
      Prefix: prefix,
    })
  );

  return (response.Contents || []).map((obj) => ({
    key: obj.Key || "",
    size: obj.Size || 0,
    lastModified: obj.LastModified,
  }));
}
