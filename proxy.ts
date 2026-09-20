import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

// These paths have their own independent auth (CRON_SECRET bearer token for
// cron/webhook routes; NextAuth's own handler for /api/auth), so they're
// exempt from the session-required gate below rather than actually public.
const PUBLIC_PATHS = ["/login", "/api/auth", "/api/cron", "/api/webhooks"];

export default auth((req) => {
  const isPublic = PUBLIC_PATHS.some((p) => req.nextUrl.pathname.startsWith(p));
  if (!req.auth && !isPublic) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    return NextResponse.redirect(loginUrl);
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
