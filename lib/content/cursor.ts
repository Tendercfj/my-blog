import "server-only";

import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";

import { z } from "zod";

import { ApiProblem } from "@/lib/api/problem";

const cursorPayloadSchema = z
  .object({
    v: z.literal(1),
    context: z.string().min(1).max(256),
    anchor: z.string().min(1).max(512),
  })
  .strict();

function signingSecret(): string {
  const configured = process.env.CONTENT_CURSOR_SECRET?.trim();
  if (configured && configured.length >= 32) return configured;
  if (process.env.NODE_ENV !== "production") {
    return "local-development-content-cursor-secret";
  }
  throw new Error("CONTENT_CURSOR_SECRET must contain at least 32 characters");
}

function signature(encodedPayload: string): Buffer {
  return createHmac("sha256", signingSecret())
    .update("content-cursor:v1:")
    .update(encodedPayload)
    .digest();
}

function invalidCursor(): ApiProblem {
  return new ApiProblem(400, "INVALID_CURSOR", "分页游标无效或已过期");
}

export function encodeContentCursor(context: string, anchor: string): string {
  const payload = cursorPayloadSchema.parse({ v: 1, context, anchor });
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  );
  return `${encodedPayload}.${signature(encodedPayload).toString("base64url")}`;
}

export function decodeContentCursor(token: string, context: string): string {
  try {
    if (token.length < 1 || token.length > 2048) throw invalidCursor();

    const [encodedPayload, encodedSignature, ...rest] = token.split(".");
    if (!encodedPayload || !encodedSignature || rest.length) {
      throw invalidCursor();
    }

    const suppliedSignature = Buffer.from(encodedSignature, "base64url");
    const expectedSignature = signature(encodedPayload);
    if (
      suppliedSignature.length !== expectedSignature.length ||
      !timingSafeEqual(suppliedSignature, expectedSignature)
    ) {
      throw invalidCursor();
    }

    const payload = cursorPayloadSchema.parse(
      JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")),
    );
    if (payload.context !== context) throw invalidCursor();
    return payload.anchor;
  } catch (error) {
    if (error instanceof ApiProblem) throw error;
    throw invalidCursor();
  }
}
