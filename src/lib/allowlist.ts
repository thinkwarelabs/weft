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

// Who may view the audit log. A separate, smaller list than ALLOWED_EMAILS:
// every allowlisted user can sign in and use the app, but only AUDIT_ADMINS
// can see the trail of who did what.
export function isAuditAdmin(
  email: string | null | undefined,
  admins: string = process.env.AUDIT_ADMINS ?? ''
): boolean {
  return isAllowedEmail(email, admins)
}
