import { readFile } from "node:fs/promises";

const migrationDirectory = new URL("../db/migrations/", import.meta.url);
const baseline = await readFile(
  new URL("0001_baseline.sql", migrationDirectory),
  "utf8",
);
const r2Migration = await readFile(
  new URL("0002_r2_image_urls.sql", migrationDirectory),
  "utf8",
);
const contract = await readFile(
  new URL("../db/tests/schema-contract.sql", import.meta.url),
  "utf8",
);

function topLevelSemicolons(source) {
  const positions = [];

  for (let index = 0; index < source.length; index += 1) {
    const current = source[index];
    const next = source[index + 1];

    if (current === "-" && next === "-") {
      index = source.indexOf("\n", index + 2);
      if (index === -1) break;
      continue;
    }

    if (current === "/" && next === "*") {
      const end = source.indexOf("*/", index + 2);
      if (end === -1) throw new Error("SQL contains an unterminated block comment");
      index = end + 1;
      continue;
    }

    if (current === "'") {
      for (index += 1; index < source.length; index += 1) {
        if (source[index] !== "'") continue;
        if (source[index + 1] === "'") {
          index += 1;
          continue;
        }
        break;
      }
      continue;
    }

    if (current === '"') {
      for (index += 1; index < source.length; index += 1) {
        if (source[index] !== '"') continue;
        if (source[index + 1] === '"') {
          index += 1;
          continue;
        }
        break;
      }
      continue;
    }

    if (current === "$") {
      const tag = source.slice(index).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/)?.[0];
      if (tag) {
        const end = source.indexOf(tag, index + tag.length);
        if (end === -1) throw new Error(`SQL contains an unterminated ${tag} block`);
        index = end + tag.length - 1;
        continue;
      }
    }

    if (current === ";") positions.push(index);
  }

  return positions;
}

function requireText(source, text, owner) {
  if (!source.includes(text)) {
    throw new Error(`${owner} is missing required contract text: ${text}`);
  }
}

const semicolons = topLevelSemicolons(baseline);
if (semicolons.length !== 1) {
  throw new Error(
    `0001_baseline.sql must contain one top-level statement; found ${semicolons.length}`,
  );
}
if (!/^\s*(?:--[^\n]*\n\s*)*DO \$baseline\$/u.test(baseline)) {
  throw new Error("0001_baseline.sql must start with one DO $baseline$ statement");
}

const dynamicCommands = baseline.match(/EXECUTE \$ddl\$/g)?.length ?? 0;
if (dynamicCommands !== 53) {
  throw new Error(
    `0001_baseline.sql must contain 53 ordered DDL commands; found ${dynamicCommands}`,
  );
}

for (const delimiter of ["$baseline$", "$ddl$", "$function$"]) {
  const count = baseline.split(delimiter).length - 1;
  if (count % 2 !== 0) {
    throw new Error(`0001_baseline.sql contains an unpaired ${delimiter} delimiter`);
  }
}

for (const required of [
  "owner_accounts_singleton_key_uq UNIQUE (singleton_key)",
  "posts_slug_ck CHECK",
  "posts_status_ck CHECK",
  "posts_version_ck CHECK",
  "CREATE TRIGGER posts_touch_version",
  "CREATE VIEW blog.public_posts AS",
  "CREATE TABLE blog.post_audit_events",
  "post_audit_events_action_ck CHECK",
]) {
  requireText(baseline, required, "0001_baseline.sql");
}

if (topLevelSemicolons(r2Migration).length !== 1) {
  throw new Error("0002_r2_image_urls.sql must be one atomic DO statement");
}
for (const required of [
  "author_profiles_avatar_src_ck",
  "posts_cover_all_or_none_ck",
  "https://assets[.]tendercfj[.]cc[.]cd/.+",
]) {
  requireText(r2Migration, required, "0002_r2_image_urls.sql");
}

for (const required of [
  "single-owner constraint",
  "post version trigger",
  "published slug immutability",
  "post status constraint",
  "post slug uniqueness",
  "audit action constraint",
  "public view exposed a deleted draft",
  "ROLLBACK;",
]) {
  requireText(contract, required, "db/tests/schema-contract.sql");
}

process.stdout.write(
  `Verified ${dynamicCommands} baseline DDL commands, atomic R2 migration, and disposable schema contract.\n`,
);
