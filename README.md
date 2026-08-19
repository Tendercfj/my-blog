This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Cloudflare R2 上传

复制 `.env.example` 为 `.env`，填写 Cloudflare R2 的 S3 API 凭据（Account ID、Access Key ID、Secret Access Key 和 Bucket 名称）。上传方法位于 [`lib/storage/r2.ts`](/Users/xy/Desktop/test/my-blog/lib/storage/r2.ts)，只允许在服务端调用：

```ts
import { uploadToR2 } from "@/lib/storage/r2";

const result = await uploadToR2("uploads", fileBuffer);

// 在 Next.js Route Handler 中，也可以直接传入 formData 得到的 File：
const fileResult = await uploadToR2("uploads", file);

console.log(result.url);
```

方法只接收 `path` 和资源内容。服务端生成 UUID 名称并与 `path` 拼接成 R2 object key；`File`/`Blob` 的 MIME 类型会自动设置，`Buffer`、`Uint8Array` 或字符串也可以作为内容传入。上传结果包含 `name`、`key`、`url`、`etag` 和 `versionId`，其中 `url` 使用 `CLOUDFLARE_R2_PUBLIC_URL` 生成。

服务端读取原始 R2 内容时使用：

```ts
import { readFromR2 } from "@/lib/storage/r2";

const object = await readFromR2("uploads", result.name);
const bytes = await object.Body?.transformToByteArray();
```

### 前端上传并保存 URL

现有数据库需要先放宽头像和文章封面的 URL 约束，不会创建新表：

```bash
psql "$DATABASE_URL_UNPOOLED" -v ON_ERROR_STOP=1 -f db/migrations/0002_r2_image_urls.sql
```

然后在已登录的 Client Component 中只传 `path` 和文件内容。服务端会生成 UUID 文件名并保留安全的原扩展名：

```tsx
"use client";

import { uploadMedia } from "@/lib/media/client";

async function handleFile(file: File) {
  const uploaded = await uploadMedia("posts/covers", file);

  console.log(uploaded.name);
  console.log(uploaded.url);
  // https://assets.tendercfj.cc.cd/posts/covers/<uuid>.jpg

  // 保存文章时，将 uploaded.url 写入 posts.cover_src。
  // 保存头像时，将 uploaded.url 写入 author_profiles.avatar_src。
}
```

`POST /api/v1/media` 接收 `multipart/form-data` 的 `path` 和 `file`，要求站长登录且请求同源。接口返回服务端生成的 `name`、`key`、真实公开 `url`、MIME、大小、ETag 和 VersionId。上传接口不新增数据库记录；头像或文章保存接口分别把 URL 写入现有的 `author_profiles.avatar_src` 或 `posts.cover_src`。

该方法使用 [Cloudflare R2 S3 API](https://developers.cloudflare.com/r2/get-started/s3/) 的 endpoint（`https://<ACCOUNT_ID>.r2.cloudflarestorage.com`）和 `region: "auto"`。公开资源通过已绑定到同一 bucket 的 custom domain `https://assets.tendercfj.cc.cd` 访问。

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
