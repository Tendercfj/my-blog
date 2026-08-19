This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Cloudflare R2 上传

复制 `.env.example` 为 `.env`，填写 Cloudflare R2 的 S3 API 凭据（Account ID、Access Key ID、Secret Access Key 和 Bucket 名称）。上传方法位于 [`lib/storage/r2.ts`](/Users/xy/Desktop/test/my-blog/lib/storage/r2.ts)，只允许在服务端调用：

```ts
import { uploadToR2 } from "@/lib/storage/r2";

const result = await uploadToR2("uploads", fileName, fileBuffer);

// 在 Next.js Route Handler 中，也可以直接传入 formData 得到的 File：
const fileResult = await uploadToR2("uploads", file.name, file);

console.log(result.ETag);
```

方法的三个参数依次是 `path`、`name` 和资源内容。`path`、`name` 会拼接成 R2 object key；`File`/`Blob` 的 MIME 类型会自动设置，`Buffer`、`Uint8Array` 或字符串也可以作为内容传入。

该方法使用 [Cloudflare R2 S3 API](https://developers.cloudflare.com/r2/get-started/s3/) 的 endpoint（`https://<ACCOUNT_ID>.r2.cloudflarestorage.com`）和 `region: "auto"`。R2 不会自动生成公开访问 URL；如需公开访问，请在 Cloudflare 控制台配置 custom domain 或 public bucket。

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
