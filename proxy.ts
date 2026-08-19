import { type NextRequest, NextResponse } from "next/server";

import { sessionCookieName } from "@/lib/auth/cookie";

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/login") {
    return NextResponse.next();
  }

  if (!request.cookies.has(sessionCookieName)) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|images|.*\\..*).*)"],
};
