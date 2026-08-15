// Query-string handling for search, kept pure so it can be tested.
//
// The old version of this file existed to escape user input before it was
// interpolated into a PostgREST filter string. Prisma parameterises, so that
// hazard is gone — what's left is turning what someone typed into something
// Postgres full-text search will actually match.

export type SearchKind = 'client' | 'project' | 'invoice' | 'timeline' | 'idea'

export interface SearchHit {
  kind: SearchKind
  id: string
  title: string
  subtitle: string | null
  href: string
}

/**
 * Strip characters that would break a `tsquery`, then join the remaining words
 * with AND and make the final one a prefix.
 *
 * The prefix match is what makes this usable while typing: "acm" finds "Acme"
 * before you have finished the word. Without it, results only appear on a
 * complete token and the box feels broken.
 *
 * Returns '' when there is nothing searchable, and callers must treat that as
 * "no query" rather than passing it to Postgres.
 */
export function toTsQuery(input: string): string {
  const words = input
    .toLowerCase()
    // & | ! ( ) : * are tsquery operators; anything else non-word is a separator.
    .replace(/[&|!():*'"\\]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

  if (words.length === 0) return ''
  return words.map((w, i) => (i === words.length - 1 ? `${w}:*` : w)).join(' & ')
}

/**
 * The plain `contains` fallback for names and numbers.
 *
 * Full-text search tokenises, which is right for prose but wrong for
 * identifiers: "TWL-0004" is one token to a human and several to the parser,
 * and nobody types a whole client name to find it. So names and invoice
 * numbers use a substring match while bodies use the tsvector indexes.
 */
export function sanitizeContains(input: string): string {
  return input.trim().replace(/\s+/g, ' ')
}

/** Cheap relevance nudge: exact prefix beats a match buried in the middle. */
export function rankHits(hits: SearchHit[], query: string): SearchHit[] {
  const q = query.trim().toLowerCase()
  const score = (h: SearchHit) => {
    const t = h.title.toLowerCase()
    if (t === q) return 0
    if (t.startsWith(q)) return 1
    if (t.includes(q)) return 2
    return 3
  }
  return [...hits].sort((a, b) => score(a) - score(b) || a.title.localeCompare(b.title))
}
