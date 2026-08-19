"use client";

import { CircleAlert } from "lucide-react";
import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="page-container page-section">
      <section className="glass-card px-6 py-20 text-center">
        <CircleAlert className="mx-auto size-12 text-primary" aria-hidden="true" />
        <h1 className="mt-5 text-3xl font-black text-card-foreground">页面加载遇到问题</h1>
        <p className="mx-auto mt-3 max-w-md text-muted-foreground">可以重新尝试，或先回到首页继续浏览。</p>
        <div className="mt-7 flex justify-center gap-3">
          <button type="button" onClick={reset} className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground hover:opacity-90">重试</button>
          <Link href="/" className="rounded-lg border border-border px-5 py-2.5 font-semibold text-card-foreground hover:bg-muted">返回首页</Link>
        </div>
      </section>
    </div>
  );
}
