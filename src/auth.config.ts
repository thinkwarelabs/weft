import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

// EDGE-SAFE half of the auth config.
//
// middleware.ts runs on the edge runtime, where Prisma (a Node driver over TCP)
// cannot run. So the config is split: everything here is pure and
// database-free, and the DB-touching callbacks live in src/auth.ts, which only
// route handlers and server components import.
//
// If you ever add a callback here that reads the database, middleware will
// break at runtime with an opaque error. Put it in src/auth.ts instead.

/** Empty until ThinkWare Labs is on Google Workspace. See lib/auth/identity.ts. */
export const WORKSPACE_DOMAIN = (process.env.WORKSPACE_DOMAIN ?? "").trim();

export const authConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          // `hd` pre-filters Google's account chooser. It is a UI hint only and
          // is NOT a security control — the real check is in the signIn
          // callback. Omitted entirely in allowlist mode, where sending it
          // would hide the team's own Gmail accounts from the picker.
          ...(WORKSPACE_DOMAIN ? { hd: WORKSPACE_DOMAIN } : {}),
          prompt: "select_account",
        },
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/signin", error: "/signin" },
  trustHost: true,
  callbacks: {
    // Surface the DB user id, the trust-boundary marker and the hosted-domain
    // claim on the session. `role` is asserted rather than assumed: middleware
    // and requireInternal() both check it explicitly instead of settling for
    // "a session exists".
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.uid as string) ?? "";
        session.user.role = (token.role as "internal") ?? "internal";
        session.user.hd = (token.hd as string | null) ?? null;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
