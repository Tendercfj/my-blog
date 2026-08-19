import "server-only";

import { randomUUID } from "node:crypto";
import { extname } from "node:path";

import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type GetObjectCommandOutput,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";

const R2_ENDPOINT_SUFFIX = ".r2.cloudflarestorage.com";

const contentTypeExtensions: Readonly<Record<string, string>> = {
  "image/avif": ".avif",
  "image/gif": ".gif",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/svg+xml": ".svg",
  "image/webp": ".webp",
  "application/json": ".json",
  "application/pdf": ".pdf",
  "application/zip": ".zip",
  "text/plain": ".txt",
};

export type R2UploadContent = NonNullable<PutObjectCommandInput["Body"]>;

export type R2UploadResult = {
  name: string;
  key: string;
  url: string;
  etag?: string;
  versionId?: string;
};

export type R2Object = GetObjectCommandOutput & {
  key: string;
  url: string;
};

export class R2ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "R2ConfigurationError";
  }
}

export class R2StorageError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "R2StorageError";
  }
}

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl: string;
};

let r2Client: S3Client | undefined;
let r2Config: R2Config | undefined;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new R2ConfigurationError(`缺少 R2 环境变量：${name}`);
  }
  return value;
}

function getR2Config(): R2Config {
  r2Config ??= {
    accountId: requiredEnv("CLOUDFLARE_ACCOUNT_ID"),
    accessKeyId: requiredEnv("CLOUDFLARE_R2_ACCESS_KEY_ID"),
    secretAccessKey: requiredEnv("CLOUDFLARE_R2_SECRET_ACCESS_KEY"),
    bucketName: requiredEnv("CLOUDFLARE_R2_BUCKET_NAME"),
    publicUrl: publicBaseUrl(requiredEnv("CLOUDFLARE_R2_PUBLIC_URL")),
  };
  return r2Config;
}

function publicBaseUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") {
      throw new Error("R2 public URL must use HTTPS");
    }
    if (url.username || url.password || url.search || url.hash) {
      throw new Error("R2 public URL cannot contain credentials, query, or hash");
    }
    url.pathname = `${url.pathname.replace(/\/+$/, "")}/`;
    return url.toString();
  } catch (error) {
    throw new R2ConfigurationError(
      `R2 环境变量 CLOUDFLARE_R2_PUBLIC_URL 无效：${error instanceof Error ? error.message : "未知错误"}`,
    );
  }
}

function getR2Client(): S3Client {
  if (r2Client) return r2Client;

  const config = getR2Config();
  r2Client = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}${R2_ENDPOINT_SUFFIX}`,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  return r2Client;
}

export function createR2ObjectKey(path: string, name: string): string {
  const normalizedPath = path.trim().replace(/^\/+|\/+$/g, "");
  const normalizedName = name.trim().replace(/^\/+|\/+$/g, "");

  if (!normalizedName) {
    throw new TypeError("R2 object name cannot be empty");
  }
  if (
    normalizedName === "." ||
    normalizedName === ".." ||
    normalizedName.includes("/") ||
    normalizedName.includes("\\")
  ) {
    throw new TypeError("R2 object name cannot contain path separators");
  }

  const segments = normalizedPath ? normalizedPath.split("/") : [];
  if (
    segments.some(
      (segment) =>
        !segment || segment === "." || segment === ".." || segment.includes("\\"),
    )
  ) {
    throw new TypeError("R2 object path contains an invalid segment");
  }

  return normalizedPath ? `${normalizedPath}/${normalizedName}` : normalizedName;
}

function encodedObjectKey(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

export function getR2PublicUrl(path: string, name: string): string {
  const key = createR2ObjectKey(path, name);
  return new URL(encodedObjectKey(key), getR2Config().publicUrl).toString();
}

function isBlob(content: R2UploadContent): content is Blob {
  return typeof Blob !== "undefined" && content instanceof Blob;
}

function uniqueObjectName(content: R2UploadContent): string {
  const originalName = isBlob(content) && "name" in content ? String(content.name) : "";
  const originalExtension = extname(originalName).toLocaleLowerCase("en-US");
  const contentType = isBlob(content)
    ? content.type.split(";", 1)[0].trim().toLocaleLowerCase("en-US")
    : "";
  const extension = /^\.[a-z0-9]{1,16}$/.test(originalExtension)
    ? originalExtension
    : (contentTypeExtensions[contentType] ?? ".bin");
  return `${randomUUID()}${extension}`;
}

async function uploadBody(content: R2UploadContent): Promise<{
  body: R2UploadContent;
  contentType?: string;
}> {
  if (!isBlob(content)) {
    return { body: content };
  }

  return {
    body: new Uint8Array(await content.arrayBuffer()),
    ...(content.type ? { contentType: content.type } : {}),
  };
}

/**
 * Uploads a resource to the configured Cloudflare R2 bucket through its S3 API.
 * A unique UUID name is generated on the server. File/Blob content is converted
 * to bytes and its MIME type is forwarded automatically when available.
 */
export async function uploadToR2(
  path: string,
  content: R2UploadContent,
): Promise<R2UploadResult> {
  const config = getR2Config();
  const uploaded = await uploadBody(content);
  const name = uniqueObjectName(content);
  const key = createR2ObjectKey(path, name);

  let result;
  try {
    result = await getR2Client().send(
      new PutObjectCommand({
        Bucket: config.bucketName,
        Key: key,
        Body: uploaded.body,
        ...(uploaded.contentType ? { ContentType: uploaded.contentType } : {}),
      }),
    );
  } catch (error) {
    throw new R2StorageError("R2 upload failed", error);
  }

  return {
    name,
    key,
    url: new URL(encodedObjectKey(key), config.publicUrl).toString(),
    ...(result.ETag ? { etag: result.ETag } : {}),
    ...(result.VersionId ? { versionId: result.VersionId } : {}),
  };
}

/** Reads an R2 object through the authenticated S3 API on the server. */
export async function readFromR2(path: string, name: string): Promise<R2Object> {
  const config = getR2Config();
  const key = createR2ObjectKey(path, name);
  let result;
  try {
    result = await getR2Client().send(
      new GetObjectCommand({
        Bucket: config.bucketName,
        Key: key,
      }),
    );
  } catch (error) {
    throw new R2StorageError("R2 read failed", error);
  }

  return {
    ...result,
    key,
    url: new URL(encodedObjectKey(key), config.publicUrl).toString(),
  };
}
