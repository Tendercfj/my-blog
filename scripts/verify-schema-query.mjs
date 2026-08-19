import { readFile } from "node:fs/promises";

const schemaPath = new URL(
  "../.trellis/tasks/08-18-neon-api-database-docs/schema.sql",
  import.meta.url,
);
const schema = await readFile(schemaPath, "utf8");

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
      if (end === -1) throw new Error("schema.sql contains an unterminated block comment");
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
        if (end === -1) throw new Error(`schema.sql contains an unterminated ${tag} block`);
        index = end + tag.length - 1;
        continue;
      }
    }

    if (current === ";") positions.push(index);
  }

  return positions;
}

const semicolons = topLevelSemicolons(schema);
if (semicolons.length !== 1) {
  throw new Error(`schema.sql must contain one top-level statement; found ${semicolons.length}`);
}

const statement = schema.slice(0, semicolons[0] + 1);
if (!/^\s*(?:--[^\n]*\n\s*)*DO \$baseline\$/u.test(statement)) {
  throw new Error("schema.sql must start with one DO $baseline$ statement");
}

const trailingSql = schema
  .slice(semicolons[0] + 1)
  .replaceAll(/--[^\n]*(?:\n|$)/g, "")
  .replaceAll(/\/\*[\s\S]*?\*\//g, "")
  .trim();
if (trailingSql) {
  throw new Error("schema.sql contains SQL after the baseline statement");
}

const dynamicCommands = schema.match(/EXECUTE \$ddl\$/g)?.length ?? 0;
if (dynamicCommands !== 53) {
  throw new Error(`schema.sql must contain 53 ordered dynamic DDL commands; found ${dynamicCommands}`);
}

for (const delimiter of ["$baseline$", "$ddl$", "$function$"]) {
  const count = schema.split(delimiter).length - 1;
  if (count % 2 !== 0) {
    throw new Error(`schema.sql contains an unpaired ${delimiter} delimiter`);
  }
}

process.stdout.write(
  `Verified one prepared-query statement with ${dynamicCommands} ordered DDL commands.\n`,
);
