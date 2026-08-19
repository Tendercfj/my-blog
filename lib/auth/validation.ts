import { z } from "zod";

export const loginInputSchema = z
  .object({
    email: z.string().trim().email("请输入有效邮箱").max(320),
    password: z.string().min(1, "请输入密码").max(1024),
  })
  .strict();

export const registerInputSchema = z
  .object({
    email: z.string().trim().email("请输入有效邮箱").max(320),
    password: z.string().min(12, "密码至少需要 12 位").max(1024),
    passwordConfirmation: z.string().min(1, "请再次输入密码").max(1024),
  })
  .strict()
  .refine((input) => input.password === input.passwordConfirmation, {
    path: ["passwordConfirmation"],
    message: "两次输入的密码不一致",
  });

export function normalizeOwnerEmail(email: string): string {
  return email.trim().toLocaleLowerCase("en-US");
}
