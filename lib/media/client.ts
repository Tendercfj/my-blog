import type { UploadedResource } from "@/lib/media/types";

type MediaUploadSuccess = {
  data: UploadedResource;
};

type MediaUploadFailure = {
  error?: {
    message?: string;
  };
};

export class MediaUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaUploadError";
  }
}

/** Uploads a browser File/Blob. The server generates the object name. */
export async function uploadMedia(
  path: string,
  content: Blob,
): Promise<UploadedResource> {
  const formData = new FormData();
  formData.set("path", path);
  formData.set(
    "file",
    content,
    typeof File !== "undefined" && content instanceof File ? content.name : "upload",
  );

  const response = await fetch("/api/v1/media", {
    method: "POST",
    body: formData,
  });
  const payload: MediaUploadSuccess | MediaUploadFailure = await response.json();

  if (!response.ok || !("data" in payload)) {
    const message = "error" in payload ? payload.error?.message : undefined;
    throw new MediaUploadError(message || "资源上传失败");
  }

  return payload.data;
}
