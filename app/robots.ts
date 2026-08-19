import type { MetadataRoute } from "next";

import { getSiteConfig } from "@/lib/content/repository";
import { absoluteUrl } from "@/lib/metadata";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const site = await getSiteConfig();
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/account", "/api/"] },
    sitemap: absoluteUrl("/sitemap.xml", site),
  };
}
