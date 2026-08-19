import { CircleUserRound, FilePenLine } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { LogoutButton } from "@/components/auth/logout-button";
import { FullWidthLayout } from "@/components/site/page-layout";
import { requireCurrentSession } from "@/lib/auth/session";
import { routes } from "@/lib/routes";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "站长账号",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const session = await requireCurrentSession();

  return (
    <FullWidthLayout>
      <section className="mx-auto w-full max-w-3xl py-4 sm:py-10">
        <div className="glass-card overflow-hidden">
          <div className="border-b border-border bg-primary/6 px-5 py-7 sm:px-8">
            <p className="flex items-center gap-2 text-xs font-bold tracking-[0.16em] text-primary uppercase">
              <CircleUserRound className="size-4" aria-hidden="true" />Owner workspace
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-card-foreground">
              站长账号
            </h1>
            <p className="mt-2 text-muted-foreground">当前登录邮箱：{session.email}</p>
          </div>
          <div className="grid gap-5 px-5 py-7 sm:px-8">
            <div className="rounded-xl border border-border bg-background/65 p-5">
              <FilePenLine className="size-5 text-primary" aria-hidden="true" />
              <h2 className="mt-3 text-lg font-bold text-card-foreground">文章工作流</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                登录认证已就绪；文章草稿、发布与删除入口将在对应内容接口接入后显示在这里。
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
