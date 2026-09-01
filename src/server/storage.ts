import { S3Client, PutObjectCommand, GetObjectCommand, HeadBucketCommand, CreateBucketCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";
import dotenv from "dotenv";
// See src/server/db.ts for why this module loads its own env vars rather than relying on
// import order relative to server.ts's dotenv.config() call.
dotenv.config();

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || "http://localhost:9000";
const MINIO_BUCKET = process.env.MINIO_BUCKET || "billslayer-case-files";

export const s3Client = new S3Client({
  endpoint: MINIO_ENDPOINT,
  region: "us-east-1",
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.MINIO_ROOT_USER || "billslayer",
    secretAccessKey: process.env.MINIO_ROOT_PASSWORD || "billslayer_dev_pw",
  },
});

export async function waitForMinio(maxAttempts = 10, delayMs = 1500): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await s3Client.send(new HeadBucketCommand({ Bucket: MINIO_BUCKET }));
      console.log(`Connected to MinIO, bucket "${MINIO_BUCKET}" is ready.`);
      return;
    } catch (err: any) {
      // Bucket missing (not started via any init step) -> create it once, then continue.
      if (err?.$metadata?.httpStatusCode === 404 || err?.name === "NotFound") {
        try {
          await s3Client.send(new CreateBucketCommand({ Bucket: MINIO_BUCKET }));
          console.log(`Created MinIO bucket "${MINIO_BUCKET}".`);
          return;
        } catch (createErr) {
          console.warn(`Failed to auto-create MinIO bucket: ${(createErr as Error).message}`);
        }
      }
      console.warn(`MinIO not ready yet (attempt ${attempt}/${maxAttempts}): ${(err as Error).message}`);
      if (attempt === maxAttempts) {
        throw new Error(
          `Could not connect to MinIO after ${maxAttempts} attempts. Is bin/minio.exe running on ${MINIO_ENDPOINT}? ` +
          `Original error: ${(err as Error).message}`
        );
      }
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
}

export async function uploadCaseFile(buffer: Buffer, caseId: string, originalFilename: string, mimeType: string): Promise<string> {
  const key = `case-files/${caseId}/${crypto.randomUUID()}-${sanitizeFilename(originalFilename)}`;
  await s3Client.send(new PutObjectCommand({
    Bucket: MINIO_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
  }));
  return key;
}

export async function getCaseFileBuffer(objectKey: string): Promise<Buffer> {
  const result = await s3Client.send(new GetObjectCommand({ Bucket: MINIO_BUCKET, Key: objectKey }));
  const stream = result.Body as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
