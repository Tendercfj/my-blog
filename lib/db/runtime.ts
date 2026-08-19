import "server-only";

import { neon } from "@neondatabase/serverless";

export class DatabaseUnavailableError extends Error {
  constructor(cause?: unknown) {
    super("Database unavailable", { cause });
    this.name = "DatabaseUnavailableError";
  }
}

let runtimeClient: ReturnType<typeof neon> | undefined;

function runtimeDatabaseUrl(): string {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    throw new DatabaseUnavailableError();
  }

  try {
    const url = new URL(value);
    if (!["postgres:", "postgresql:"].includes(url.protocol)) {
      throw new Error("Unsupported database protocol");
    }
    if (process.env.NODE_ENV === "production" && !url.hostname.includes("-pooler")) {
      throw new Error("Production runtime must use a pooled Neon connection");
    }
  } catch (error) {
    throw new DatabaseUnavailableError(error);
  }

  return value;
}

function getRuntimeClient() {
  runtimeClient ??= neon(runtimeDatabaseUrl());
  return runtimeClient;
}

export async function queryRows(
  statement: string,
  parameters: readonly unknown[] = [],
): Promise<unknown[]> {
  try {
    const result: unknown = await getRuntimeClient().query(statement, [...parameters]);
    if (!Array.isArray(result)) {
      throw new Error("Unexpected database response");
    }
    return result;
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) throw error;
    throw new DatabaseUnavailableError(error);
  }
}
