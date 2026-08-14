// The client authorization decision, in one pure place.
//
// This ran in two copies — once when exchanging a mailed link for a cookie, and
// again on every subsequent request. Five identical checks, written twice. That
// is exactly the kind of duplication that drifts, and a drift here fails OPEN:
// one copy forgetting `revokedAt` means revoking a link silently does nothing.
//
// So the decision lives here, with no I/O, and both call sites ask it.

export type AccessDecision =
  | 'ok'
  | 'not_found'
  | 'revoked'
  | 'expired'
  | 'contact_inactive'
  | 'project_archived'
  | 'wrong_scope'

/**
 * Everything the decision depends on, read fresh from the database on EVERY
 * request. Nothing here is trusted from the cookie — the cookie only says which
 * token row to look at.
 */
export interface TokenSnapshot {
  scope: string
  expiresAt: Date
  revokedAt: Date | null
  contactActive: boolean
  projectArchivedAt: Date | null
}

/**
 * May the holder of this token act right now?
 *
 * Deny by default: a null row, an unknown scope, or any single failing
 * condition returns a refusal. The order matters only for the reason returned,
 * which is for the audit log — the caller must treat every non-'ok' identically
 * when talking to the client.
 */
export function evaluateAccess(
  row: TokenSnapshot | null | undefined,
  now: Date = new Date(),
  requiredScope = 'feedback',
): AccessDecision {
  if (!row) return 'not_found'
  if (row.scope !== requiredScope) return 'wrong_scope'
  if (row.revokedAt !== null) return 'revoked'
  // Expiry is exclusive: a token is dead at its expiry instant, not after it.
  if (row.expiresAt.getTime() <= now.getTime()) return 'expired'
  // Re-read every request, so deactivating a contact or archiving a project
  // takes effect immediately rather than whenever the cookie happens to lapse.
  if (!row.contactActive) return 'contact_inactive'
  if (row.projectArchivedAt !== null) return 'project_archived'
  return 'ok'
}

export function isAllowed(decision: AccessDecision): boolean {
  return decision === 'ok'
}

/**
 * What the client is told. Deliberately identical for every refusal — the
 * difference between "revoked", "expired" and "never existed" is information
 * about what exists, and the holder of a bad link has not earned it.
 */
export const CLIENT_REFUSAL_MESSAGE = 'This link is no longer valid.'
