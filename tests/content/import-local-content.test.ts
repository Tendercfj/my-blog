import { spawnSync } from "node:child_process";

import { describe, expect, it, vi } from "vitest";

import { posts } from "@/content/posts";
import { siteConfig } from "@/content/site";
import {
  loadLocalContent,
  parseImportArguments,
  runContentImport,
} from "@/scripts/import-local-content-lib.mjs";

const fixture = {
  site: siteConfig,
  posts,
};

function sqlFixture(preflight: Record<string, unknown>) {
  const query = vi.fn().mockResolvedValue([preflight]);
  const transaction = vi.fn();
  return { query, transaction };
}

describe("local content import", () => {
  it("loads and validates the checked-in TypeScript content modules", async () => {
    await expect(loadLocalContent()).resolves.toMatchObject({
      site: { name: siteConfig.name },
      posts,
    });
  });

  it("is dry-run by default and never opens a transaction", async () => {
    expect(parseImportArguments([])).toEqual({ apply: false, help: false });
    const sql = sqlFixture({
      ownerId: "00000000-0000-0000-0000-000000000001",
      postCount: 0,
      profileState: "default",
      siteState: "missing",
    });

    await expect(
      runContentImport({
        apply: false,
        openSql: () => sql as never,
        loadContent: async () => fixture,
        write: vi.fn(),
      }),
    ).resolves.toMatchObject({ applied: false });
    expect(sql.transaction).not.toHaveBeenCalled();
  });

  it("accepts pnpm's argument separator and shows help without database access", () => {
    expect(parseImportArguments(["--", "--help"])).toEqual({
      apply: false,
      help: true,
    });

    const environment = { ...process.env };
    delete environment.DATABASE_URL_UNPOOLED;
    const result = spawnSync(
      process.execPath,
      ["scripts/import-local-content.mjs", "--", "--help"],
      { cwd: process.cwd(), encoding: "utf8", env: environment },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("用法：pnpm content:import [--apply]");
    expect(result.stderr).toBe("");
  });

  it("refuses apply when the target already contains a post", async () => {
    const sql = sqlFixture({
      ownerId: "00000000-0000-0000-0000-000000000001",
      postCount: 1,
      profileState: "custom",
      siteState: "custom",
    });

    await expect(
      runContentImport({
        apply: true,
        openSql: () => sql as never,
        loadContent: async () => fixture,
        write: vi.fn(),
      }),
    ).rejects.toThrow("已有文章");
    expect(sql.transaction).not.toHaveBeenCalled();
  });

  it("builds all writes inside one transaction", async () => {
    const queries: { statement: string; parameters: readonly unknown[] }[] = [];
    const sql = sqlFixture({
      ownerId: "00000000-0000-0000-0000-000000000001",
      postCount: 0,
      profileState: "default",
      siteState: "default",
    });
    sql.transaction.mockImplementation(async (callback) =>
      callback({
        query(statement: string, parameters: readonly unknown[] = []) {
          queries.push({ statement, parameters });
          return Promise.resolve([]);
        },
      }),
    );

    await expect(
      runContentImport({
        apply: true,
        openSql: () => sql as never,
        loadContent: async () => fixture,
        write: vi.fn(),
      }),
    ).resolves.toMatchObject({ applied: true });
    expect(sql.transaction).toHaveBeenCalledOnce();
    expect(queries[0]?.statement).toContain("LOCK TABLE blog.posts");
    expect(queries[1]?.statement).toContain(
      "NOT EXISTS (SELECT 1 FROM blog.posts)",
    );
    expect(queries[2]?.statement).toContain(
      "SELECT 1 FROM blog.owner_accounts",
    );
    expect(queries.some(({ statement }) => statement.includes("INSERT INTO blog.posts"))).toBe(true);
    expect(queries.some(({ statement }) => statement.includes("INSERT INTO blog.post_tags"))).toBe(true);
    expect(queries.some(({ statement }) => statement.includes("INSERT INTO blog.post_audit_events"))).toBe(true);

    const profileWrite = queries.find(({ statement }) =>
      statement.includes("INSERT INTO blog.author_profiles"),
    );
    const siteWrite = queries.find(({ statement }) =>
      statement.includes("INSERT INTO blog.site_settings"),
    );
    expect(profileWrite?.statement).toContain(
      "WHERE blog.author_profiles.version = 1",
    );
    expect(siteWrite?.statement).toContain(
      "WHERE blog.site_settings.version = 1",
    );
  });

  it("safely refuses a repeated import after the first apply", async () => {
    const ownerId = "00000000-0000-0000-0000-000000000001";
    const sql = sqlFixture({});
    sql.query
      .mockResolvedValueOnce([
        {
          ownerId,
          postCount: 0,
          profileState: "default",
          siteState: "default",
        },
      ])
      .mockResolvedValueOnce([
        {
          ownerId,
          postCount: posts.length,
          profileState: "custom",
          siteState: "custom",
        },
      ]);
    sql.transaction.mockImplementation(async (callback) =>
      callback({
        query() {
          return Promise.resolve([]);
        },
      }),
    );

    const options = {
      apply: true,
      openSql: () => sql as never,
      loadContent: async () => fixture,
      write: vi.fn(),
    };
    await expect(runContentImport(options)).resolves.toMatchObject({
      applied: true,
    });
    await expect(runContentImport(options)).rejects.toThrow("已有文章");
    expect(sql.transaction).toHaveBeenCalledOnce();
  });
});
