import type { Metadata } from "next";
import type { ReactNode } from "react";

import { SearchProvider } from "@/components/search/search-provider";
import { FloatingTools } from "@/components/site/floating-tools";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { requireCurrentSession } from "@/lib/auth/session";
import {
  getSearchIndex,
  getSiteConfig,
  getSiteStats,
} from "@/lib/content/repository";

export async function generateMetadata(): Promise<Metadata> {
  await requireCurrentSession();
  const site = await getSiteConfig();
  return {
    metadataBase: new URL(site.siteUrl),
    title: {
      default: site.name,
      template: `%s · ${site.name}`,
    },
    description: site.description,
    openGraph: {
      type: "website",
      locale: "zh_CN",
      siteName: site.name,
      title: site.name,
      description: site.description,
    },
    twitter: {
      card: "summary_large_image",
      title: site.name,
      description: site.description,
    },
  };
}

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  await requireCurrentSession();
  const [site, searchDocuments, stats] = await Promise.all([
    getSiteConfig(),
    getSearchIndex(),
    getSiteStats(),
  ]);

  return (
    <SearchProvider documents={searchDocuments}>
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>
      <div className="site-shell">
        <SiteHeader site={site} stats={stats} />
        <main id="main-content">{children}</main>
        <SiteFooter site={site} />
      </div>
      <FloatingTools />
    </SearchProvider>
  );
}
