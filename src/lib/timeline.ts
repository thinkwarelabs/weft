// Timeline rules, pure and testable.
//
// TimelineEntry is one object with two authors: internal notes we write about a
// client conversation, and feedback the client writes back. The database
// enforces that exactly one author is set (timeline_author_exclusive) and that
// a client can only ever author `feedback` (timeline_client_kind). These
// functions are the application-side rules that sit on top of that.

/** Kinds an internal user may author. `status_change` is written by the system. */
export const AUTHORABLE_KINDS = ['note', 'milestone'] as const
export type AuthorableKind = (typeof AUTHORABLE_KINDS)[number]

/** Kinds a client may ever see. Allowlist — extend consciously. */
export const CLIENT_VISIBLE_KINDS = ['feedback', 'milestone'] as const

/**
 * The grace window for removing an entry, matching the Idea Board's rule.
 *
 * A timeline is a log, so entries are not editable — a record you can rewrite
 * is not a record. The window exists only to undo a mistake made moments ago.
 */
export const DELETE_WINDOW_MS = 15 * 60 * 1000

export interface DeletableEntry {
  authorType: 'internal' | 'client'
  authorUserId: string | null
  createdAt: Date
}

/**
 * May this user delete this entry?
 *
 * Three conditions, all required:
 *  - it is an INTERNAL entry. Client feedback is the client's own words; we do
 *    not get to remove it from the record.
 *  - the requester wrote it.
 *  - it is younger than the grace window.
 *
 * Derived entirely from authorship and age — there is no "deletable" flag that
 * could drift out of sync with the rule.
 */
export function canDeleteEntry(
  entry: DeletableEntry,
  userId: string,
  now: Date = new Date(),
): boolean {
  if (entry.authorType !== 'internal') return false
  if (!entry.authorUserId || entry.authorUserId !== userId) return false
  const ageMs = now.getTime() - entry.createdAt.getTime()
  return ageMs >= 0 && ageMs < DELETE_WINDOW_MS
}

/** Milliseconds left in the window (0 once expired). UI convenience. */
export function deleteWindowRemainingMs(createdAt: Date, now: Date = new Date()): number {
  return Math.max(0, DELETE_WINDOW_MS - (now.getTime() - createdAt.getTime()))
}

/** Would a client ever see an entry of this kind? */
export function isClientVisible(kind: string): boolean {
  return (CLIENT_VISIBLE_KINDS as readonly string[]).includes(kind)
}
