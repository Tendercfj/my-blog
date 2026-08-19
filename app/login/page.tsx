import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/login-form";
import { FullWidthLayout } from "@/components/site/page-layout";

export const metadata: Metadata = {
  title: "站长登录",
  description: "登录唯一站长账号以管理博客内容。",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <FullWidthLayout>
      <section className="mx-auto w-full max-w-md py-4 sm:py-10">
        <div className="glass-card px-5 py-7 sm:px-8 sm:py-9">
          <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary/12 text-primary">
            <ShieldCheck className="size-6" aria-hidden="true" />
          </div>
          <div className="mt-4 text-center">
            <p className="text-xs font-bold tracking-[0.18em] text-primary uppercase">Owner access</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-card-foreground sm:text-3xl">
              站长登录
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              本站不开放注册，仅允许通过本地 bootstrap 创建的唯一账号登录。
            </p>
          </div>
          <LoginForm />
        </div>
      </section>
    </FullWidthLayout>
  );
}
