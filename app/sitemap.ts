import type { MetadataRoute } from "next";

import {
  getAllCategories,
  getAllPosts,
  getAllTags,
  getSiteConfig,
} from "@/lib/content/repository";
import { absoluteUrl } from "@/lib/metadata";
import { routes } from "@/lib/routes";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [site, posts, tags, categories] = await Promise.all([
    getSiteConfig(),
    getAllPosts(),
    getAllTags(),
    getAllCategories(),
  ]);
  const fixedRoutes = [routes.home, routes.archives, routes.tags, routes.categories, routes.about];

  return [
    ...fixedRoutes.map((path) => ({
      url: absoluteUrl(path, site),
      changeFrequency: "monthly" as const,
      priority: path === "/" ? 1 : 0.7,
    })),
    ...posts.map((post) => ({
      url: absoluteUrl(routes.post(post.slug), site),
      lastModified: new Date(`${post.updatedAt ?? post.publishedAt}T00:00:00Z`),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...tags.map((tag) => ({
      url: absoluteUrl(routes.tag(tag.slug), site),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
    ...categories.map((category) => ({
      url: absoluteUrl(routes.category(category.slug), site),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
