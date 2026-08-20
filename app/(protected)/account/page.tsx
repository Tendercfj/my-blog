import { CircleUserRound, FilePenLine, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { LogoutButton } from "@/components/auth/logout-button";
import { FullWidthLayout } from "@/components/site/page-layout";
import { requireCurrentSession } from "@/lib/auth/session";
import { listOwnerPosts } from "@/lib/content/owner-repository";
import { getSiteConfig } from "@/lib/content/service";
import { routes } from "@/lib/routes";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "站长账号",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const session = await requireCurrentSession();
  const [site, allPosts] = await Promise.all([
    getSiteConfig(),
    listOwnerPosts(session.accountId, { status: "all" }),
  ]);
  const posts = allPosts.filter(
    (post) => post.status === "draft" || post.status === "published",
  );
  const draftCount = posts.filter((post) => post.status === "draft").length;
  const publishedCount = posts.length - draftCount;

  return (
    <FullWidthLayout>
      <section className="mx-auto w-full max-w-4xl py-4 sm:py-10">
        <div className="glass-card overflow-hidden">
          <div className="border-b border-border bg-primary/6 px-5 py-7 sm:px-8">
            <p className="flex items-center gap-2 text-xs font-bold tracking-[0.16em] text-primary uppercase">
              <CircleUserRound className="size-4" aria-hidden="true" />Owner workspace
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-card-foreground">
              站长账号
            </h1>
            <p className="mt-2 text-muted-foreground">当前登录邮箱：{session.email}</p>
            <div className="mt-4 rounded-xl border border-border/70 bg-background/45 px-4 py-3">
              <p className="text-sm font-semibold text-card-foreground">{site.author.name}</p>
              <p className="mt-1 text-xs text-primary">{site.author.role || "站长"}</p>
              {site.author.bio ? (
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{site.author.bio}</p>
              ) : null}
            </div>
          </div>
          <div className="grid gap-5 px-5 py-7 sm:px-8">
            <section className="rounded-xl border border-border bg-background/65 p-5" aria-labelledby="owner-posts-title">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 id="owner-posts-title" className="text-lg font-bold text-card-foreground">文章管理</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    草稿 {draftCount} 篇 · 已发布 {publishedCount} 篇
                  </p>
                </div>
                <Link
                  href={routes.accountPostNew}
                  className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="size-4" aria-hidden="true" />新建文章
                </Link>
              </div>
              {posts.length ? (
                <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
                  {posts.map((post) => (
                    <li key={post.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold text-card-foreground">{post.title}</h3>
                        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className={post.status === "draft" ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}>
                            {post.status === "draft" ? "草稿" : "已发布"}
                          </span>
                          <span>版本 {post.version}</span>
                          <span>{post.publishedAt?.slice(0, 10) ?? "尚未发布"}</span>
                        </p>
                      </div>
                      <Link href={routes.accountPostEdit(post.id)} className="inline-flex items-center gap-1 rounded-lg border border-primary/30 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/8">
                        <FilePenLine className="size-4" aria-hidden="true" />编辑
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-4 rounded-lg border border-dashed border-border p-8 text-center">
                  <Plus className="mx-auto size-6 text-primary" aria-hidden="true" />
                  <p className="mt-2 text-sm text-muted-foreground">还没有文章，从一篇新草稿开始吧。</p>
                  <Link
                    href={routes.accountPostNew}
                    className="mt-4 inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground"
                  >
                    <Plus className="size-4" aria-hidden="true" />创建第一篇文章
                  </Link>
                </div>
              )}
            </section>
            <div className="rounded-xl border border-border bg-background/65 p-5">
              <FilePenLine className="size-5 text-primary" aria-hidden="true" />
              <h2 className="mt-3 text-lg font-bold text-card-foreground">文章工作流</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                当前工作区只展示你本人拥有的文章；保存时会校验版本，避免覆盖并发修改。
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link
                href={routes.home}
                className="rounded-lg px-3 py-2 text-sm font-medium text-primary hover:bg-primary/8"
              >
                返回博客首页
              </Link>
              <LogoutButton />
            </div>
          </div>
        </div>
      </section>
    </FullWidthLayout>
  );
}
