import "server-only";

import {
  PutObjectCommand,
  S3Client,
  type PutObjectCommandInput,
  type PutObjectCommandOutput,
} from "@aws-sdk/client-s3";

const R2_ENDPOINT_SUFFIX = ".r2.cloudflarestorage.com";

export type R2UploadContent = NonNullable<PutObjectCommandInput["Body"]>;

export class R2ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "R2ConfigurationError";
  }
}

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
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
  };
  return r2Config;
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

function objectKey(path: string, name: string): string {
  const normalizedPath = path.trim().replace(/^\/+|\/+$/g, "");
  const normalizedName = name.trim().replace(/^\/+|\/+$/g, "");

  if (!normalizedName) {
    throw new TypeError("R2 object name cannot be empty");
  }

  return normalizedPath ? `${normalizedPath}/${normalizedName}` : normalizedName;
}

function isBlob(content: R2UploadContent): content is Blob {
  return typeof Blob !== "undefined" && content instanceof Blob;
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
 * `path` and `name` are joined with one `/`; File/Blob content is converted to
 * bytes and its MIME type is forwarded automatically when available.
 */
export async function uploadToR2(
  path: string,
  name: string,
  content: R2UploadContent,
): Promise<PutObjectCommandOutput> {
  const config = getR2Config();
  const uploaded = await uploadBody(content);

  return getR2Client().send(
    new PutObjectCommand({
      Bucket: config.bucketName,
      Key: objectKey(path, name),
      Body: uploaded.body,
      ...(uploaded.contentType ? { ContentType: uploaded.contentType } : {}),
    }),
  );
}
