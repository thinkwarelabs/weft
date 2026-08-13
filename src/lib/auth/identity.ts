// The internal-access rule, in one pure, testable place.
//
// Two modes, chosen by whether WORKSPACE_DOMAIN is configured:
//
//   Workspace mode (WORKSPACE_DOMAIN set)
//     Access requires a verified `hd` claim on Google's ID token matching the
//     domain. This is the real assertion — an `email.endsWith("@domain")` check
//     is NOT equivalent and must never be substituted.
//
//   Allowlist mode (WORKSPACE_DOMAIN empty)
//     ThinkWare Labs is on consumer Gmail accounts today, which carry no `hd`
//     claim at all. Until there's a Workspace, access is a server-side list of
//     addresses, checked in the signIn callback BEFORE a session is issued.
//
// The modes are deliberately exclusive rather than OR'd. If they were OR'd, the
// Gmail addresses would stay valid forever after a Workspace was set up and the
// migration would never actually complete. Setting WORKSPACE_DOMAIN is the
// switch that closes the old door.
//
// No I/O here on purpose — this is the rule, and it has tests.

export interface InternalIdentityConfig {
  /** Google Workspace domain, or null/empty for allowlist mode. */
  workspaceDomain?: string | null;
  /** Raw comma-separated list; normalised internally. */
  allowedEmails?: string | null;
}

export interface IdentityClaims {
  email?: string | null;
  /** Google's `email_verified` claim. */
  emailVerified?: boolean | null;
  /** Google's hosted-domain claim. Absent on consumer accounts. */
  hd?: string | null;
}

export function parseEmailList(csv: string | null | undefined): string[] {
  return (csv ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isWorkspaceMode(config: InternalIdentityConfig): boolean {
  return Boolean(config.workspaceDomain && config.workspaceDomain.trim());
}

/**
 * The gate. Returns true only if this Google identity may access the internal
 * surface. Deny by default: any missing or ambiguous claim fails.
 */
export function isInternalIdentity(
  claims: IdentityClaims,
  config: InternalIdentityConfig,
): boolean {
  const email = claims.email?.trim().toLowerCase();
  if (!email) return false;

  // Google must have verified the address in every mode. An unverified email
  // means someone could have signed up with an address they don't control.
  if (claims.emailVerified !== true) return false;

  if (isWorkspaceMode(config)) {
    const domain = config.workspaceDomain!.trim().toLowerCase();
    const hd = claims.hd?.trim().toLowerCase();
    // No `hd` means a consumer account. Reject, regardless of what the email
    // address happens to look like.
    return Boolean(hd) && hd === domain;
  }

  return parseEmailList(config.allowedEmails).includes(email);
}

/**
 * Re-assert the rule for an already-issued session, where we have the email and
 * the `hd` we carried on the token at sign-in.
 *
 * This is defence in depth: the strong check ran at sign-in. It exists so a
 * token minted under an older configuration stops working when the config
 * tightens, rather than living out its full lifetime.
 */
export function isInternalSession(
  session: { email?: string | null; hd?: string | null },
  config: InternalIdentityConfig,
): boolean {
  return isInternalIdentity(
    { email: session.email, emailVerified: true, hd: session.hd },
    config,
  );
}
