// The Idea Board rules, ported from Trove. Pure — no I/O, no imports from the
// data layer, so it can be unit-tested directly. The route handlers do the
// database work, per the convention in CLAUDE.md.
//
// APPEND-ONLY BY CONSTRUCTION. There is no update function here, no PATCH
// route, and no edit path anywhere in the app — and that absence IS the
// guarantee. Refinement happens in comments and threaded replies, never by
// rewriting the original. Do not add one.
//
// Deletion is the single exception: the author, within 15 minutes, to undo a
// mistake. Same window and same reasoning as the client timeline.

export const DELETE_WINDOW_MS = 15 * 60 * 1000

/** Longest an idea's title and body may be. Generous; a guard, not a style rule. */
export const MAX_TITLE = 200
export const MAX_BODY = 20_000
export const MAX_COMMENT = 10_000

/**
 * Pure authorization rule. Derived entirely from authorship and age — there is
 * no "deletable" flag that could drift out of sync with the rule, because there
 * is no flag.
 */
export function canDeleteIdea(
  idea: { authorId: string; createdAt: Date },
  userId: string,
  now: Date = new Date(),
): boolean {
  if (!idea.authorId || idea.authorId !== userId) return false
  const ageMs = now.getTime() - idea.createdAt.getTime()
  return ageMs >= 0 && ageMs < DELETE_WINDOW_MS
}

/** Milliseconds left in the window (0 once expired). UI convenience. */
export function deleteWindowRemainingMs(createdAt: Date, now: Date = new Date()): number {
  return Math.max(0, DELETE_WINDOW_MS - (now.getTime() - createdAt.getTime()))
}

/**
 * Is this reply target valid for this idea?
 *
 * A crafted parentId could otherwise graft a thread from one idea onto another,
 * so the parent's own ideaId must match.
 */
export function isValidReplyTarget(
  parent: { ideaId: string } | null | undefined,
  ideaId: string,
): boolean {
  return Boolean(parent && parent.ideaId === ideaId)
}

export interface ThreadNode<T> {
  node: T
  replies: ThreadNode<T>[]
}

/**
 * Assemble a flat comment list into threads.
 *
 * Orphans — a reply whose parent is missing from the input — are promoted to
 * the top level rather than dropped. Losing a comment because its parent was
 * removed would be worse than showing it slightly out of place.
 */
export function buildThread<T extends { id: string; parentId: string | null }>(
  comments: T[],
): ThreadNode<T>[] {
  const nodes = new Map<string, ThreadNode<T>>()
  for (const c of comments) nodes.set(c.id, { node: c, replies: [] })

  const roots: ThreadNode<T>[] = []
  for (const c of comments) {
    const self = nodes.get(c.id)!
    const parent = c.parentId ? nodes.get(c.parentId) : undefined
    if (parent) parent.replies.push(self)
    else roots.push(self)
  }
  return roots
}
