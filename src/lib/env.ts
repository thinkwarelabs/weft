import "server-only";

// Centralised, validated environment access. Importing `env` guarantees the
// required vars exist and gives you types, instead of scattering
// `process.env.X!` across the codebase.
//
// This throws at module load. That is deliberate: a missing secret should fail
// the build/boot loudly, not surface as a confusing 500 at 2am. All of these
// must be set in the Vercel project (all environments) before deploying.

const required = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  // Signs the client-facing capability cookie. MUST be a different value from
  // AUTH_SECRET — the two trust boundaries never share a signing key.
  "CLIENT_TOKEN_SECRET",
  // Public origin, used to build client feedback links.
  "APP_URL",
] as const;

// Internal access is configured by exactly one of these two (see
// lib/auth/identity.ts). WORKSPACE_DOMAIN wins when set.
//
//   WORKSPACE_DOMAIN — Google Workspace domain, verified via the `hd` claim.
//   INTERNAL_EMAILS  — comma-separated allowlist, used until there's a
//                      Workspace. ThinkWare Labs is on consumer Gmail today.

type RequiredKey = (typeof required)[number];

interface OptionalEnv {
  WORKSPACE_DOMAIN: string;
  INTERNAL_EMAILS: string;
  DIRECT_URL?: string;
  AUDIT_ADMINS?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  HEALTHCHECK_KEY?: string;
  EMAIL_HOST?: string;
  EMAIL_PORT?: string;
  EMAIL_SECURE?: string;
  EMAIL_USER?: string;
  EMAIL_PASSWORD?: string;
  EMAIL_FROM?: string;
  EMAIL_TO?: string;
  EMAIL_CC?: string;
  DRIVE_OWNER_EMAIL?: string;
  DRIVE_TOKEN_ENCRYPTION_KEY?: string;
  GOOGLE_REDIRECT_URI?: string;
  OPENAI_API_KEY?: string;
}

function readEnv(): Record<RequiredKey, string> & OptionalEnv {
  const missing: string[] = [];
  const out = {} as Record<RequiredKey, string>;

  for (const key of required) {
    const value = process.env[key];
    if (!value || value.trim() === "") missing.push(key);
    else out[key] = value.trim();
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}.\n` +
        `Copy .env.example to .env and fill them in.`,
    );
  }

  if (out.CLIENT_TOKEN_SECRET === out.AUTH_SECRET) {
    throw new Error(
      "CLIENT_TOKEN_SECRET must differ from AUTH_SECRET. The internal and " +
        "client trust boundaries must not share a signing key — if they do, a " +
        "cookie minted for one is valid for the other.",
    );
  }

  const workspaceDomain = (process.env.WORKSPACE_DOMAIN ?? "").trim();
  const internalEmails = (process.env.INTERNAL_EMAILS ?? "").trim();

  // Exactly one of the two access modes must be configured. Neither means
  // nobody can sign in, which is a silent, confusing failure — fail loudly at
  // boot instead.
  if (!workspaceDomain && !internalEmails) {
    throw new Error(
      "Set WORKSPACE_DOMAIN (Google Workspace SSO) or INTERNAL_EMAILS " +
        "(allowlist). With neither, no one can sign in. See " +
        "src/lib/auth/identity.ts.",
    );
  }

  return {
    ...out,
    WORKSPACE_DOMAIN: workspaceDomain,
    INTERNAL_EMAILS: internalEmails,
    DIRECT_URL: process.env.DIRECT_URL,
    AUDIT_ADMINS: process.env.AUDIT_ADMINS,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
    HEALTHCHECK_KEY: process.env.HEALTHCHECK_KEY,
    EMAIL_HOST: process.env.EMAIL_HOST,
    EMAIL_PORT: process.env.EMAIL_PORT,
    EMAIL_SECURE: process.env.EMAIL_SECURE,
    EMAIL_USER: process.env.EMAIL_USER,
    EMAIL_PASSWORD: process.env.EMAIL_PASSWORD,
    EMAIL_FROM: process.env.EMAIL_FROM,
    EMAIL_TO: process.env.EMAIL_TO,
    EMAIL_CC: process.env.EMAIL_CC,
    DRIVE_OWNER_EMAIL: process.env.DRIVE_OWNER_EMAIL,
    DRIVE_TOKEN_ENCRYPTION_KEY: process.env.DRIVE_TOKEN_ENCRYPTION_KEY,
    GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  };
}

export const env = readEnv();

/** Who may view the audit log — a narrower list than "is internal". */
export function isAuditAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const admins = (env.AUDIT_ADMINS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.trim().toLowerCase());
}
