import "server-only";

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    const configuredOrigin = process.env.APP_ORIGIN?.trim();
    const expectedOrigin = configuredOrigin
      ? new URL(configuredOrigin).origin
      : new URL(request.url).origin;
    return new URL(origin).origin === expectedOrigin;
  } catch {
    return false;
  }
}
