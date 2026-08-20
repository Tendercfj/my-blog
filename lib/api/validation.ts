import type { ZodType } from "zod";

import { ApiProblem, type ApiErrorDetail } from "@/lib/api/problem";

export function parseApiInput<T>(schema: ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (parsed.success) return parsed.data;

  const details: readonly ApiErrorDetail[] = parsed.error.issues.map(
    (issue) => ({
      field: issue.path.join(".") || undefined,
      reason: issue.code.toUpperCase(),
      message: issue.message,
    }),
  );
  throw new ApiProblem(
    422,
    "VALIDATION_FAILED",
    "请求字段校验失败",
    details,
  );
}
