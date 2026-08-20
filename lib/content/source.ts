import "server-only";

import type { ContentRepository } from "@/lib/content/contracts";
import { localContentRepository } from "@/lib/content/local-repository";
import { neonContentRepository } from "@/lib/content/neon-repository";

export type BlogContentSource = "local" | "neon";

export function resolveBlogContentSource(
  environment: NodeJS.ProcessEnv = process.env,
): BlogContentSource {
  const source = environment.BLOG_CONTENT_SOURCE?.trim();

  if (source !== "local" && source !== "neon") {
    throw new Error(
      "BLOG_CONTENT_SOURCE must be explicitly set to either local or neon",
    );
  }

  if (environment.NODE_ENV === "production" && source !== "neon") {
    throw new Error("BLOG_CONTENT_SOURCE=local is forbidden in production");
  }

  return source;
}

export function selectContentRepository(
  environment: NodeJS.ProcessEnv = process.env,
  repositories: Readonly<Record<BlogContentSource, ContentRepository>> = {
    local: localContentRepository,
    neon: neonContentRepository,
  },
): ContentRepository {
  return repositories[resolveBlogContentSource(environment)];
}

let selectedRepository: ContentRepository | undefined;

export function getContentRepository(): ContentRepository {
  selectedRepository ??= selectContentRepository();
  return selectedRepository;
}
