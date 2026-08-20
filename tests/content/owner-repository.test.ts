import { describe, expect, it } from "vitest";

import type { QueryExecutor } from "@/lib/content/contracts";
import { createOwnerContentRepository } from "@/lib/content/owner-repository";
import type { OwnerPostUpdateInput } from "@/lib/content/schemas";

const ownerId = "023e4567-e89b-42d3-a456-426614174000";
const postId = "223e4567-e89b-42d3-a456-426614174000";
const requestId = "123e4567-e89b-42d3-a456-426614174000";

function postRow(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    id: postId,
    owner_id: ownerId,
    version: 1,
    status: "draft",
    deleted_at: null,
    slug: "owner-post",
    title: "站长文章",
    excerpt: null,
    category_slug: null,
    category_name: null,
    tags: [],
    cover_src: null,
    cover_alt: null,
    cover_width: null,
    cover_height: null,
    featured: false,
    body: [
      { type: "paragraph", children: [{ type: "text", value: "正文" }] },
    ],
    published_at: null,
    row_updated_at: new Date("2026-08-20T08:00:00.000Z"),
    ...overrides,
  };
}

function executorWithResponses(responses: readonly (readonly unknown[])[]) {
  const calls: {
    statement: string;
    parameters: readonly unknown[];
  }[] = [];
  let index = 0;
  const executor: QueryExecutor = {
    async queryRows(statement, parameters = []) {
      calls.push({ statement, parameters });
      const response = responses[index];
      index += 1;
      if (!response) throw new Error(`Unexpected query: ${statement}`);
      return response;
    },
  };
  return { executor, calls };
}

const updateInput: OwnerPostUpdateInput = {
  version: 3,
  slug: "owner-post",
  title: "更新后的站长文章",
  excerpt: "一段摘要",
  category: "notes",
  tags: ["nextjs", "react"],
  cover: {
    src: "/images/posts/cover.svg",
    alt: "文章封面",
    width: 1200,
    height: 675,
  },
  featured: true,
  body: [
    { type: "heading", level: 2, id: "intro", text: "介绍" },
    { type: "paragraph", children: [{ type: "text", value: "正文" }] },
  ],
};

describe("owner content repository", () => {
  it("always scopes owner lists and detail reads by accountId", async () => {
    const { executor, calls } = executorWithResponses([[], []]);
    const repository = createOwnerContentRepository(executor);

    await expect(
      repository.listOwnerPosts(ownerId, { status: "all" }),
    ).resolves.toEqual([]);
    await expect(
      repository.getOwnerPostById(ownerId, postId),
    ).resolves.toBeNull();

    expect(calls[0].statement).toContain("p.owner_id = $1");
    expect(calls[0].parameters).toEqual([ownerId]);
    expect(calls[1].statement).toContain("p.owner_id = $1 AND p.id = $2");
    expect(calls[1].parameters).toEqual([ownerId, postId]);
  });

  it("creates a draft and its audit event in one owner-bound SQL statement", async () => {
    const { executor, calls } = executorWithResponses([
      [{ id: postId, version: 1 }],
      [postRow()],
    ]);
    const repository = createOwnerContentRepository(executor);

    const created = await repository.createOwnerPost(
      ownerId,
      {
        slug: "owner-post",
        title: "站长文章",
        excerpt: null,
        category: null,
        tags: [],
        cover: null,
        featured: false,
        body: [
          {
            type: "paragraph",
            children: [{ type: "text", value: "正文" }],
          },
        ],
      },
      requestId,
    );

    expect(created).toMatchObject({ ownerId, id: postId, status: "draft" });
    expect(calls[0].statement).toContain("INSERT INTO blog.posts");
    expect(calls[0].statement).toContain("INSERT INTO blog.post_audit_events");
    expect(calls[0].statement).toContain("'create'");
    expect(calls[0].parameters[0]).toBe(ownerId);
    expect(calls[0].parameters.at(-1)).toBe(requestId);
  });

  it("updates content with owner/version guards and a body-free audit summary", async () => {
    const publishedRow = postRow({
      version: 3,
      status: "published",
      excerpt: "一段摘要",
      category_slug: "notes",
      category_name: "notes",
      tags: [{ slug: "nextjs", name: "nextjs" }],
      cover_src: "/images/posts/cover.svg",
      cover_alt: "文章封面",
      cover_width: 1200,
      cover_height: 675,
      published_at: new Date("2026-08-19T08:00:00.000Z"),
    });
    const { executor, calls } = executorWithResponses([
      [publishedRow],
      [{ id: postId, version: 4 }],
      [postRow({ ...publishedRow, version: 4, title: updateInput.title })],
    ]);
    const repository = createOwnerContentRepository(executor);

    await expect(
      repository.updateOwnerPost(
        ownerId,
        postId,
        updateInput.version,
        updateInput,
        requestId,
      ),
    ).resolves.toMatchObject({
      id: postId,
      ownerId,
      version: 4,
      title: updateInput.title,
    });

    const mutation = calls[1];
    expect(mutation.statement).toContain(
      "id = $1 AND owner_id = $2 AND version = $3",
    );
    expect(mutation.statement).toContain("INSERT INTO blog.post_audit_events");
    expect(mutation.statement).toContain(
      "jsonb_build_object('version', updated.version, 'fields'",
    );
    expect(mutation.statement).not.toContain("jsonb_build_object('body'");
    expect(mutation.parameters.slice(0, 4)).toEqual([
      postId,
      ownerId,
      3,
      "owner-post",
    ]);
  });

  it("rejects stale versions and any slug change after first publication", async () => {
    const staleFixture = executorWithResponses([[postRow({ version: 4 })]]);
    const staleRepository = createOwnerContentRepository(staleFixture.executor);
    await expect(
      staleRepository.updateOwnerPost(
        ownerId,
        postId,
        3,
        updateInput,
        requestId,
      ),
    ).rejects.toMatchObject({ code: "VERSION_CONFLICT", status: 409 });
    expect(staleFixture.calls).toHaveLength(1);

    const archivedFixture = executorWithResponses([
      [
        postRow({
          version: 3,
          status: "archived",
          published_at: new Date("2026-08-19T08:00:00.000Z"),
        }),
      ],
    ]);
    const archivedRepository = createOwnerContentRepository(
      archivedFixture.executor,
    );
    await expect(
      archivedRepository.updateOwnerPost(
        ownerId,
        postId,
        3,
        { ...updateInput, slug: "changed-slug" },
        requestId,
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED", status: 422 });
    expect(archivedFixture.calls).toHaveLength(1);
  });

  it("publishes only complete owner drafts with an expected version", async () => {
    const completeDraft = postRow({
      version: 3,
      excerpt: "一段摘要",
      category_slug: "notes",
      category_name: "notes",
      cover_src: "/images/posts/cover.svg",
      cover_alt: "文章封面",
      cover_width: 1200,
      cover_height: 675,
    });
    const publishedRow = postRow({
      ...completeDraft,
      version: 4,
      status: "published",
      published_at: new Date("2026-08-20T08:30:00.000Z"),
    });
    const { executor, calls } = executorWithResponses([
      [completeDraft],
      [{ id: postId, version: 4 }],
      [publishedRow],
    ]);
    const repository = createOwnerContentRepository(executor);

    await expect(
      repository.publishOwnerPost(ownerId, postId, 3, requestId),
    ).resolves.toMatchObject({ status: "published", version: 4 });
    expect(calls[1].statement).toContain("p.owner_id = $2");
    expect(calls[1].statement).toContain("p.version = $3");
    expect(calls[1].statement).toContain("'publish'");
    expect(calls[1].parameters).toEqual([postId, ownerId, 3, requestId]);

    const incompleteFixture = executorWithResponses([[postRow({ version: 3 })]]);
    const incompleteRepository = createOwnerContentRepository(
      incompleteFixture.executor,
    );
    await expect(
      incompleteRepository.publishOwnerPost(ownerId, postId, 3, requestId),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED", status: 422 });
    expect(incompleteFixture.calls).toHaveLength(1);
  });
});
