import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

import { PostEditor } from "@/components/account/post-editor";
import { FullWidthLayout } from "@/components/site/page-layout";
import { requireCurrentSession } from "@/lib/auth/session";
import { getOwnerPostById } from "@/lib/content/owner-repository";
import { routes } from "@/lib/routes";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "编辑文章", robots: { index: false, follow: false } };

export default async function EditOwnerPostPage({ params }: PageProps) {
  const session = await requireCurrentSession();
  const { id } = await params;
  const post = await getOwnerPostById(session.accountId, id);
  if (!post) notFound();
  return <FullWidthLayout><div className="mx-auto w-full max-w-6xl"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold tracking-[0.16em] text-primary uppercase">Owner workspace</p><h1 className="mt-1 text-3xl font-black tracking-tight text-card-foreground">编辑：{post.title}</h1></div><Link href={routes.account} className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-primary hover:bg-muted">返回账号页</Link></div><PostEditor post={post} /></div></FullWidthLayout>;
}
