import { z } from "zod";

export const contentSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const contentSlugSchema = z
  .string()
  .max(100, "slug 不能超过 100 个字符")
  .regex(contentSlugPattern, "slug 格式无效");
