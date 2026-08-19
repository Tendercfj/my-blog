import { FileQuestion } from "lucide-react";
import Link from "next/link";

import { requireCurrentSession } from "@/lib/auth/session";

export default async function NotFound() {
  await requireCurrentSession();

  return (
    <div className="page-container page-section">
      <section className="glass-card px-6 py-20 text-center">
        <FileQuestion className="mx-auto size-12 text-primary" aria-hidden="true" />
        <p className="mt-5 text-xs font-bold tracking-[0.2em] text-primary">404 NOT FOUND</p>
        <h1 className="mt-2 text-3xl font-black text-card-foreground sm:text-4xl">这里暂时没有内容</h1>
        <p className="mx-auto mt-3 max-w-md text-muted-foreground">链接可能已经变化，或这个 slug 不属于当前本地内容集合。</p>
        <Link href="/" className="mt-7 inline-flex rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground hover:opacity-90">返回首页</Link>
      </section>
    </div>
  );
}
