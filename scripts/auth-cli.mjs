import { createInterface } from "node:readline/promises";

import { neon } from "@neondatabase/serverless";
import { hash } from "@node-rs/argon2";

import { passwordOptions } from "../lib/auth/password-options.mjs";

export function directSql() {
  const value = process.env.DATABASE_URL_UNPOOLED?.trim();
  if (!value) throw new Error("缺少 DATABASE_URL_UNPOOLED");

  const url = new URL(value);
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("DATABASE_URL_UNPOOLED 必须是 PostgreSQL 连接串");
  }
  if (url.hostname.includes("-pooler")) {
    throw new Error("账号 CLI 必须使用 direct connection，不能使用 -pooler hostname");
  }

  return neon(value);
}

export async function readEmail() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("账号 CLI 需要在交互式终端中运行");
  }
  const reader = createInterface({ input: process.stdin, output: process.stdout });
  const value = await reader.question("站长邮箱：");
  reader.close();
  const email = value.trim().toLocaleLowerCase("en-US");
  if (email.length < 3 || email.length > 320 || !email.includes("@")) {
    throw new Error("请输入有效邮箱");
  }
  return email;
}

export function readHidden(prompt) {
  if (!process.stdin.isTTY || !process.stdout.isTTY || !process.stdin.setRawMode) {
    throw new Error("密码必须在支持隐藏输入的交互式终端中输入");
  }

  return new Promise((resolve, reject) => {
    const input = process.stdin;
    const output = process.stdout;
    const wasRaw = input.isRaw;
    let value = "";

    function cleanup() {
      input.off("data", onData);
      input.setRawMode(Boolean(wasRaw));
      input.pause();
      output.write("\n");
    }

    function onData(chunk) {
      for (const character of String(chunk)) {
        if (character === "\u0003") {
          cleanup();
          reject(new Error("操作已取消"));
          return;
        }
        if (character === "\r" || character === "\n") {
          cleanup();
          resolve(value);
          return;
        }
        if (character === "\u007f" || character === "\b") {
          value = value.slice(0, -1);
          continue;
        }
        if (character >= " ") value += character;
      }
    }

    output.write(prompt);
    input.setEncoding("utf8");
    input.setRawMode(true);
    input.resume();
    input.on("data", onData);
  });
}

export async function readNewPassword() {
  const password = await readHidden("新密码（至少 12 位）：");
  const confirmation = await readHidden("再次输入新密码：");
  if (password.length < 12 || password.length > 1024) {
    throw new Error("密码长度必须为 12..1024 位");
  }
  if (password !== confirmation) {
    throw new Error("两次输入的密码不一致");
  }
  return password;
}

export function hashOwnerPassword(password) {
  return hash(password, passwordOptions);
}

export function errorCode(error) {
  return error && typeof error === "object" && "code" in error ? error.code : null;
}
