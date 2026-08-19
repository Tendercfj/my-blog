import { NextResponse, type NextRequest } from "next/server";

import { ApiProblem } from "@/lib/api/problem";
import { createRequestId, errorResponse, jsonData } from "@/lib/api/response";
import { sessionCookieName } from "@/lib/auth/cookie";
import { isSameOrigin } from "@/lib/auth/origin";
import { findSessionByToken } from "@/lib/auth/session";
import { uploadToR2 } from "@/lib/storage/r2";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

function requiredText(formData: FormData, field: string): string {
  const value = formData.get(field);
  if (typeof value !== "string" || !value.trim()) {
    throw new ApiProblem(422, "VALIDATION_FAILED", `缺少上传字段：${field}`);
  }
  return value;
}

export async function POST(request: NextRequest) {
  const requestId = createRequestId();

  try {
    if (!isSameOrigin(request)) {
      throw new ApiProblem(403, "ORIGIN_NOT_ALLOWED", "请求来源不受信任");
    }

    const session = await findSessionByToken(request.cookies.get(sessionCookieName)?.value);
    if (!session) {
      throw new ApiProblem(401, "AUTHENTICATION_REQUIRED", "请先登录");
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      throw new ApiProblem(400, "INVALID_FORM_DATA", "上传表单无法解析");
    }

    const path = requiredText(formData, "path");
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new ApiProblem(422, "VALIDATION_FAILED", "缺少上传文件");
    }
    if (file.size === 0) {
      throw new ApiProblem(422, "VALIDATION_FAILED", "不能上传空文件");
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new ApiProblem(413, "FILE_TOO_LARGE", "单个资源不能超过 20 MiB");
    }
    if (path.length > 512) {
      throw new ApiProblem(422, "VALIDATION_FAILED", "资源路径过长");
    }

    let uploaded;
    try {
      uploaded = await uploadToR2(path, file);
    } catch (error) {
      if (error instanceof TypeError) {
        throw new ApiProblem(422, "VALIDATION_FAILED", error.message);
      }
      throw error;
    }

    return jsonData(
      {
        ...uploaded,
        contentType: file.type || null,
        size: file.size,
      },
      requestId,
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { Allow: "POST" } });
}
