import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow login page and auth API through
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth")
  ) {
    return NextResponse.next();
  }

  // Check for session cookie
  const session = request.cookies.get("session")?.value;
  if (!session || !isValidFormat(session)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

// Lightweight format check for Edge Runtime (full HMAC verification in API routes)
function isValidFormat(token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const ts = parseInt(parts[0], 10);
  if (isNaN(ts)) return false;
  // Check not expired (24h)
  if (Date.now() - ts > 24 * 60 * 60 * 1000) return false;
  return true;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
