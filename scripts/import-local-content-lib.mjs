import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

import ts from "typescript";

import { directSql } from "./auth-cli.mjs";

const require = createRequire(import.meta.url);

function resolveTypeScriptModuleUrl(modulePath) {
  if (modulePath.startsWith("@/")) {
    return new URL(`../${modulePath.slice(2)}.ts`, import.meta.url);
  }
  return new URL(modulePath, import.meta.url);
}

function importSpecifiers(source) {
  return [
    ...source.matchAll(/(?:from\s+|import\s*\()\s*["']([^"']+)["']/g),
  ].map((match) => match[1]);
}

async function compileTypeScriptModule(modulePath, moduleCache) {
  const moduleUrl = resolveTypeScriptModuleUrl(modulePath);
  const cacheKey = moduleUrl.href;
  const cached = moduleCache.get(cacheKey);
  if (cached) return cached;

  const pending = (async () => {
    const source = await readFile(moduleUrl, "utf8");
    const compiled = ts.transpileModule(
      source.replace(/^import "server-only";\s*$/mu, ""),
      {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
        },
        fileName: modulePath,
        reportDiagnostics: true,
      },
    );
    const errors = compiled.diagnostics?.filter(
      (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
    );
    if (errors?.length) {
      throw new Error(
        `无法加载 ${modulePath}: ${errors
          .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"))
          .join("; ")}`,
      );
    }
    let output = compiled.outputText;
    const specifiers = [...new Set(importSpecifiers(output))];
    for (const specifier of specifiers) {
      let replacement = specifier;
      if (specifier.startsWith("@/")) {
        replacement = await compileTypeScriptModule(specifier, moduleCache);
      } else if (!specifier.startsWith(".") && !specifier.startsWith("node:") && !specifier.includes("://")) {
        replacement = pathToFileURL(require.resolve(specifier)).href;
      }
      output = output
        .replaceAll(`"${specifier}"`, JSON.stringify(replacement))
        .replaceAll(`'${specifier}'`, JSON.stringify(replacement));
    }

    const encoded = Buffer.from(output).toString("base64");
    return `data:text/javascript;base64,${encoded}`;
  })();
  moduleCache.set(cacheKey, pending);
  return pending;
}

async function loadTypeScriptModule(modulePath, moduleCache) {
  return import(await compileTypeScriptModule(modulePath, moduleCache));
}

export async function loadLocalContent() {
  const moduleCache = new Map();
  const [siteModule, postModule, validatorModule] = await Promise.all([
    loadTypeScriptModule("../content/site.ts", moduleCache),
    loadTypeScriptModule("../content/posts.ts", moduleCache),
    loadTypeScriptModule("../lib/content/validate.ts", moduleCache),
  ]);
  const site = siteModule.siteConfig;
  const posts = postModule.posts;
  validatorModule.validateContent(site, posts);
  return { site, posts };
}

export function parseImportArguments(argv) {
  const flags = new Set(argv.filter((argument) => argument !== "--"));
  for (const flag of flags) {
    if (flag !== "--apply" && flag !== "--help") {
      throw new Error(`未知参数：${flag}`);
    }
  }
  return { apply: flags.has("--apply"), help: flags.has("--help") };
}

const preflightSql = `
  /* content-import:preflight */
  SELECT
    owner.id::text AS "ownerId",
    (SELECT count(*)::integer FROM blog.posts) AS "postCount",
    CASE
      WHEN profile.account_id IS NULL THEN 'missing'
      WHEN profile.version = 1
        AND profile.role = '独立博客站长'
        AND profile.bio = ''
        AND profile.avatar_src = '/images/brand/avatar.svg'
        AND profile.avatar_alt = '站长头像'
        AND profile.avatar_width = 240
        AND profile.avatar_height = 240
        AND profile.links = '[]'::jsonb
        AND profile.about = '{}'::jsonb
        THEN 'default'
      ELSE 'custom'
    END AS "profileState",
    CASE
      WHEN settings.singleton_key IS NULL THEN 'missing'
      WHEN settings.version = 1
        AND settings.name = '棱镜手记'
        AND settings.description = '记录设计、代码与日常观察的独立博客。'
        AND settings.logo_src = '/images/brand/logo.svg'
        AND settings.logo_alt = '棱镜手记标志'
        AND settings.logo_width = 96
        AND settings.logo_height = 96
        AND settings.announcement = ''
        AND settings.navigation = '[]'::jsonb
        THEN 'default'
      ELSE 'custom'
    END AS "siteState"
  FROM blog.owner_accounts AS owner
  LEFT JOIN blog.author_profiles AS profile ON profile.account_id = owner.id
  LEFT JOIN blog.site_settings AS settings ON settings.singleton_key = 1
  WHERE owner.singleton_key = 1
  LIMIT 1
`;

function decodePreflight(rows) {
  const row = rows[0];
  if (!row || typeof row !== "object") {
    return {
      ownerId: null,
      postCount: 0,
      profileState: "missing",
      siteState: "missing",
    };
  }
  const ownerId = typeof row.ownerId === "string" ? row.ownerId : null;
  const postCount = Number(row.postCount);
  const profileState = row.profileState;
  const siteState = row.siteState;
  if (
    !Number.isSafeInteger(postCount) ||
    postCount < 0 ||
    !["missing", "default", "custom"].includes(profileState) ||
    !["missing", "default", "custom"].includes(siteState)
  ) {
    throw new Error("导入 preflight 返回了无效数据");
  }
  return { ownerId, postCount, profileState, siteState };
}

function importQueries(transaction, site, posts, ownerId) {
  const taxonomyRows = {
    categories: site.categories.map(({ slug, name }) => ({ slug, name })),
    tags: site.tags.map(({ slug, name }) => ({ slug, name })),
  };
  const postRows = posts.map((post) => ({
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    categorySlug: post.category,
    cover: post.cover,
    featured: post.featured ?? false,
    body: post.body,
    publishedAt: post.publishedAt,
    updatedAt: post.updatedAt ?? null,
  }));
  const postTags = posts.flatMap((post) =>
    post.tags.map((tagSlug) => ({ postSlug: post.slug, tagSlug })),
  );

  return [
    transaction.query("LOCK TABLE blog.posts IN SHARE ROW EXCLUSIVE MODE"),
    transaction.query(
      `
        SELECT 1 / (NOT EXISTS (SELECT 1 FROM blog.posts))::integer
          AS "emptyContentGuard"
      `,
    ),
    transaction.query(
      `
        SELECT 1 / (EXISTS (
          SELECT 1 FROM blog.owner_accounts
          WHERE id = $1 AND singleton_key = 1
        ))::integer AS "ownerGuard"
      `,
      [ownerId],
    ),
    transaction.query(
      `
        INSERT INTO blog.author_profiles (
          account_id, name, role, bio, avatar_src, avatar_alt,
          avatar_width, avatar_height, links, about
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb)
        ON CONFLICT (account_id) DO UPDATE SET
          name = EXCLUDED.name,
          role = EXCLUDED.role,
          bio = EXCLUDED.bio,
          avatar_src = EXCLUDED.avatar_src,
          avatar_alt = EXCLUDED.avatar_alt,
          avatar_width = EXCLUDED.avatar_width,
          avatar_height = EXCLUDED.avatar_height,
          links = EXCLUDED.links,
          about = EXCLUDED.about
        WHERE blog.author_profiles.version = 1
          AND blog.author_profiles.role = '独立博客站长'
          AND blog.author_profiles.bio = ''
          AND blog.author_profiles.avatar_src = '/images/brand/avatar.svg'
          AND blog.author_profiles.avatar_alt = '站长头像'
          AND blog.author_profiles.avatar_width = 240
          AND blog.author_profiles.avatar_height = 240
          AND blog.author_profiles.links = '[]'::jsonb
          AND blog.author_profiles.about = '{}'::jsonb
      `,
      [
        ownerId,
        site.author.name,
        site.author.role,
        site.author.bio,
        site.author.avatar.src,
        site.author.avatar.alt,
        site.author.avatar.width,
        site.author.avatar.height,
        JSON.stringify(site.author.links),
        JSON.stringify(site.about),
      ],
    ),
    transaction.query(
      `
        INSERT INTO blog.site_settings (
          singleton_key, name, description, site_url, logo_src, logo_alt,
          logo_width, logo_height, announcement, navigation
        )
        VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
        ON CONFLICT (singleton_key) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          site_url = EXCLUDED.site_url,
          logo_src = EXCLUDED.logo_src,
          logo_alt = EXCLUDED.logo_alt,
          logo_width = EXCLUDED.logo_width,
          logo_height = EXCLUDED.logo_height,
          announcement = EXCLUDED.announcement,
          navigation = EXCLUDED.navigation
        WHERE blog.site_settings.version = 1
          AND blog.site_settings.name = '棱镜手记'
          AND blog.site_settings.description = '记录设计、代码与日常观察的独立博客。'
          AND blog.site_settings.logo_src = '/images/brand/logo.svg'
          AND blog.site_settings.logo_alt = '棱镜手记标志'
          AND blog.site_settings.logo_width = 96
          AND blog.site_settings.logo_height = 96
          AND blog.site_settings.announcement = ''
          AND blog.site_settings.navigation = '[]'::jsonb
      `,
      [
        site.name,
        site.description,
        site.siteUrl,
        site.logo.src,
        site.logo.alt,
        site.logo.width,
        site.logo.height,
        site.announcement,
        JSON.stringify(site.navigation),
      ],
    ),
    transaction.query(
      `
        INSERT INTO blog.categories (slug, name)
        SELECT source.slug, source.name
        FROM jsonb_to_recordset($1::jsonb) AS source(slug text, name text)
        ON CONFLICT (slug) DO NOTHING
      `,
      [JSON.stringify(taxonomyRows.categories)],
    ),
    transaction.query(
      `
        INSERT INTO blog.tags (slug, name)
        SELECT source.slug, source.name
        FROM jsonb_to_recordset($1::jsonb) AS source(slug text, name text)
        ON CONFLICT (slug) DO NOTHING
      `,
      [JSON.stringify(taxonomyRows.tags)],
    ),
    transaction.query(
      `
        INSERT INTO blog.posts (
          owner_id, slug, title, excerpt, status, category_id,
          cover_src, cover_alt, cover_width, cover_height, featured,
          body, published_at, content_updated_at
        )
        SELECT
          $1,
          source.slug,
          source.title,
          source.excerpt,
          'published',
          category.id,
          source.cover->>'src',
          source.cover->>'alt',
          (source.cover->>'width')::integer,
          (source.cover->>'height')::integer,
          source.featured,
          source.body,
          source."publishedAt"::timestamptz,
          source."updatedAt"::timestamptz
        FROM jsonb_to_recordset($2::jsonb) AS source(
          slug text,
          title text,
          excerpt text,
          "categorySlug" text,
          cover jsonb,
          featured boolean,
          body jsonb,
          "publishedAt" text,
          "updatedAt" text
        )
        JOIN blog.categories AS category ON category.slug = source."categorySlug"
      `,
      [ownerId, JSON.stringify(postRows)],
    ),
    transaction.query(
      `
        INSERT INTO blog.post_tags (post_id, tag_id)
        SELECT post.id, tag.id
        FROM jsonb_to_recordset($1::jsonb) AS source(
          "postSlug" text,
          "tagSlug" text
        )
        JOIN blog.posts AS post ON post.slug = source."postSlug"
        JOIN blog.tags AS tag ON tag.slug = source."tagSlug"
      `,
      [JSON.stringify(postTags)],
    ),
    transaction.query(
      `
        INSERT INTO blog.post_audit_events (
          actor_account_id, post_id, action, request_id, changes
        )
        SELECT $1, post.id, 'create', gen_random_uuid(), '{"source":"local-import"}'::jsonb
        FROM blog.posts AS post
        JOIN jsonb_array_elements_text($2::jsonb) AS slug(value)
          ON post.slug = slug.value
      `,
      [ownerId, JSON.stringify(posts.map((post) => post.slug))],
    ),
  ];
}

export async function runContentImport({
  apply,
  openSql = directSql,
  loadContent = loadLocalContent,
  write = (message) => process.stdout.write(message),
}) {
  const { site, posts } = await loadContent();
  const sql = openSql();
  const preflight = decodePreflight(await sql.query(preflightSql, []));

  write(
    [
      apply ? "模式：apply" : "模式：dry-run（未写入）",
      `owner：${preflight.ownerId ? "存在" : "缺失"}`,
      `site：${preflight.siteState}`,
      `profile：${preflight.profileState}`,
      `目标文章：${preflight.postCount}`,
      `将导入：${site.categories.length} categories / ${site.tags.length} tags / ${posts.length} posts`,
      "",
    ].join("\n"),
  );

  if (!apply) return { applied: false, preflight };
  if (!preflight.ownerId) {
    throw new Error("目标库没有站长账号；请先注册或运行 auth:bootstrap");
  }
  if (preflight.postCount > 0) {
    throw new Error("目标库已有文章，导入已安全拒绝");
  }

  await sql.transaction((transaction) =>
    importQueries(transaction, site, posts, preflight.ownerId),
  );
  write(`导入完成：${posts.length} posts\n`);
  return { applied: true, preflight };
}
