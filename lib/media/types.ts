export type UploadedResource = {
  name: string;
  key: string;
  url: string;
  contentType: string | null;
  size: number;
  etag?: string;
  versionId?: string;
};
