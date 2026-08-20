import type { Metadata } from "next";
import Link from "next/link";

import { NewPostEditor } from "@/components/account/post-editor";
import { FullWidthLayout } from "@/components/site/page-layout";
import { requireCurrentSession } from "@/lib/auth/session";
import { routes } from "@/lib/routes";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "新建文章",
  robots: { index: false, follow: false },
};

export default async function NewOwnerPostPage() {
  await requireCurrentSession();

  return (
    <FullWidthLayout>
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold tracking-[0.16em] text-primary uppercase">
              Owner workspace
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-card-foreground">
              新建文章
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              先创建草稿，补齐发布信息后再显式发布。
            </p>
          </div>
          <Link
            href={routes.account}
            className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-primary hover:bg-muted"
          >
            返回账号页
          </Link>
        </div>
        <NewPostEditor />
      </div>
    </FullWidthLayout>
  );
}
