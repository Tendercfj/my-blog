import type { Metadata } from "next";

import type { LocalImage, SiteConfig } from "@/lib/content/types";

export function absoluteUrl(path: string, site: SiteConfig): string {
  return new URL(path, site.siteUrl).toString();
}

export function createPageMetadata(
  site: SiteConfig,
  input: { title: string; description: string; path: string; image?: LocalImage },
): Metadata {
  const url = absoluteUrl(input.path, site);
  const images = input.image
    ? [
        {
          url: absoluteUrl(input.image.src, site),
          width: input.image.width,
          height: input.image.height,
          alt: input.image.alt,
        },
      ]
    : undefined;

  return {
    title: input.title,
    description: input.description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      title: input.title,
      description: input.description,
      url,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      images: images?.map((image) => image.url),
    },
  };
}

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
