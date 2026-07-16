export function isAllowedEmail(
  email: string | null | undefined,
  allowlist: string = process.env.ALLOWED_EMAILS ?? ''
): boolean {
  if (!email) return false
  const allowed = allowlist
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  return allowed.includes(email.trim().toLowerCase())
}
