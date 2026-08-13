import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      /**
       * Trust boundary marker. Only ever "internal" — clients do NOT get
       * NextAuth sessions. Checked explicitly rather than inferring
       * authorization from the mere existence of a session.
       */
      role: "internal";
      /**
       * Google's hosted-domain claim, carried from sign-in so requireInternal()
       * can re-assert the access rule. Null on consumer Gmail accounts, which
       * is the normal case until ThinkWare Labs is on Workspace.
       */
      hd: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    role?: "internal";
    hd?: string | null;
  }
}

export {};
