import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const USE_S3 = process.env.STORAGE_PROVIDER === 's3';

const s3 = USE_S3 ? new S3Client({
  region: process.env.AWS_REGION ?? 'ap-south-1',
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
  },
}) : null;

export const BUCKET = process.env.AWS_S3_BUCKET ?? '';

export interface UploadResult {
  key: string;       // S3 key or local relative path
  url: string;       // Public URL or signed URL
  provider: 'local' | 's3';
}

/**
 * Upload a file — uses S3 if STORAGE_PROVIDER=s3, otherwise local filesystem.
 * This lets you develop locally and deploy to S3 without code changes.
 */
export async function uploadFile(
  buffer: Buffer,
  filename: string,
  folder: string,          // e.g. 'workpack-docs' | 'logos' | 'avatars'
  mimeType: string
): Promise<UploadResult> {

  if (USE_S3 && s3) {
    const key = `${folder}/${filename}`;
    await s3.send(new PutObjectCommand({
      Bucket:       BUCKET,
      Key:          key,
      Body:         buffer,
      ContentType:  mimeType,
    }));

    // Use CloudFront URL if configured, otherwise construct S3 URL
    const cdnBase = process.env.AWS_CLOUDFRONT_URL;
    const url = cdnBase
      ? `${cdnBase}/${key}`
      : `https://${BUCKET}.s3.${process.env.AWS_REGION ?? 'ap-south-1'}.amazonaws.com/${key}`;

    return { key, url, provider: 's3' };
  }

  // Local filesystem fallback
  const uploadDir = path.join(process.cwd(), 'uploads', folder);
  if (!existsSync(uploadDir)) await mkdir(uploadDir, { recursive: true });

  const filePath = path.join(uploadDir, filename);
  await writeFile(filePath, buffer);

  // Verification & Logging
  const exists = existsSync(filePath);
  console.log(`[Upload] Saved file to: ${filePath} (Verified: ${exists})`);

  return {
    key: `${folder}/${filename}`,
    url: `/${folder}/${filename}`,
    provider: 'local',
  };
}

/**
 * Delete a file from S3 or local filesystem.
 */
export async function deleteFile(key: string): Promise<void> {
  if (USE_S3 && s3) {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    return;
  }
  // Local
  const filePath = path.join(process.cwd(), 'uploads', key);
  if (existsSync(filePath)) await unlink(filePath);
}

/**
 * Generate a signed URL for private S3 objects (e.g. sensitive documents).
 * For public objects, just use the direct URL.
 */
export async function getSignedDownloadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
  if (!USE_S3 || !s3) return `/api/files?key=${encodeURIComponent(key)}`; // Local: return proxy URL

  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
}

/**
 * Generate a signed URL for uploading objects to S3.
 */
export async function getPresignedPutUrl(key: string, mimeType: string, expiresInSeconds = 3600): Promise<string> {
  if (!USE_S3 || !s3) {
    // Local fallback: point to an API route that will handle the file write
    return `/api/files/upload?key=${encodeURIComponent(key)}&mimeType=${encodeURIComponent(mimeType)}`;
  }

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: mimeType,
  });

  return getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
}
