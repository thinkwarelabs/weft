import { NextResponse, type NextRequest } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Defence in depth ONLY.
//
// This used to be the whole authorization story in the Invoice app, and that
// was safe only while every session belonged to one of three trusted people.
// It is no longer the control: every internal route calls requireInternal()
// for itself, and every client route goes through client-scope.ts. If you find
// yourself relying on this file to keep something safe, the route is wrong.
//
// Edge runtime — imports @/auth.config (no Prisma), never @/auth.

const { auth } = NextAuth(authConfig);

// Publicly reachable without an internal session.
const PUBLIC_PREFIXES = [
  "/signin",
  "/api/auth", // NextAuth's own callback/signin endpoints
  "/api/health", // uptime keep-alive, gated by its own shared secret
];

// The client trust boundary. These paths must NOT be subjected to the internal
// session check — a client has no NextAuth session and never will. They are
// guarded by the scoped cookie inside the route itself.
const CLIENT_PREFIXES = ["/f", "/api/client"];

function startsWithAny(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export default auth((req: NextRequest & { auth: unknown }) => {
  const { pathname } = req.nextUrl;

  if (startsWithAny(pathname, PUBLIC_PREFIXES)) return NextResponse.next();

  // Client surface: hand off untouched. Authorization happens in
  // client-scope.ts, which re-reads the token row on every request.
  if (startsWithAny(pathname, CLIENT_PREFIXES)) return NextResponse.next();

  // Everything else is internal. Assert the role explicitly — the presence of
  // a session is not the question being asked.
  const session = req.auth as
    | { user?: { role?: string; email?: string } }
    | null;

  if (session?.user?.role === "internal") return NextResponse.next();

  if (pathname.startsWith("/api")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/signin", req.nextUrl.origin));
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico|jpg|jpeg|webp|ttf)$).*)",
  ],
};
