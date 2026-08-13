import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { isInternalIdentity } from "@/lib/auth/identity";

// FULL auth config — imports Prisma, so this file must never be pulled into
// middleware. See src/auth.config.ts for why the split exists.
//
// Boundary 1 of 2: internal users only. Client access is a completely separate
// mechanism and deliberately does NOT go through NextAuth — see
// src/lib/auth/client-token.ts.

const identityConfig = {
  workspaceDomain: env.WORKSPACE_DOMAIN,
  allowedEmails: env.INTERNAL_EMAILS,
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,

    // The gate. The rule itself lives in lib/auth/identity.ts, pure and tested;
    // this callback only supplies the claims and acts on the answer.
    async signIn({ profile }) {
      const p = profile as
        | { hd?: string; email_verified?: boolean; email?: string }
        | undefined;

      const allowed = isInternalIdentity(
        {
          email: p?.email,
          emailVerified: p?.email_verified,
          hd: p?.hd,
        },
        identityConfig,
      );
      if (!allowed || !p?.email) return false;

      // Upsert so User rows exist for foreign keys (timeline authorship, ideas,
      // files) without an Auth.js adapter. Sessions stay stateless JWTs.
      const user = await db.user.upsert({
        where: { email: p.email.toLowerCase() },
        create: {
          email: p.email.toLowerCase(),
          name: profile?.name ?? null,
          image: (profile?.picture as string | undefined) ?? null,
        },
        update: {
          name: profile?.name ?? undefined,
          image: (profile?.picture as string | undefined) ?? undefined,
        },
        select: { active: true },
      });

      // Deactivating a User row revokes access at next sign-in without needing
      // to touch Google or the env var.
      return user.active;
    },

    // Runs on sign-in (when `profile` is present) and on every later refresh.
    // Resolve the DB id once and carry it, plus the hosted-domain claim, on the
    // token — requireInternal() re-checks the same rule against these.
    async jwt({ token, profile }) {
      if (profile?.email) {
        const user = await db.user.findUnique({
          where: { email: profile.email.toLowerCase() },
          select: { id: true },
        });
        if (user) token.uid = user.id;
        token.role = "internal";
        token.hd = (profile as { hd?: string }).hd ?? null;
      }
      return token;
    },
  },
});
