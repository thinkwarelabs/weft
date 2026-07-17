// Strip characters that would break a PostgREST `.or()` / `.ilike()` filter when
// a raw user string is interpolated into it: `,` separates or-conditions, `()`
// group them, and `*` / `%` are wildcards. The caller adds its own `*` wildcards
// around the returned term (e.g. `name.ilike.*${q}*`).
export function sanitizeIlike(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .trim()
    .replace(/[,()*%\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
