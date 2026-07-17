import { describe, expect, it } from 'vitest'
import { isAllowedEmail, isAuditAdmin } from './allowlist'

const LIST = 'a@gmail.com, B@Gmail.com ,c@gmail.com'

describe('isAllowedEmail', () => {
  it('accepts listed emails case-insensitively, trimming spaces', () => {
    expect(isAllowedEmail('a@gmail.com', LIST)).toBe(true)
    expect(isAllowedEmail('b@gmail.com', LIST)).toBe(true)
    expect(isAllowedEmail('A@GMAIL.COM', LIST)).toBe(true)
  })
  it('rejects unlisted, empty and null emails', () => {
    expect(isAllowedEmail('evil@gmail.com', LIST)).toBe(false)
    expect(isAllowedEmail('', LIST)).toBe(false)
    expect(isAllowedEmail(null, LIST)).toBe(false)
    expect(isAllowedEmail('a@gmail.com', '')).toBe(false)
  })
})

describe('isAuditAdmin', () => {
  const ADMINS = 'boss@gomagentic.com, Ops@Gomagentic.com'

  it('accepts audit admins case-insensitively', () => {
    expect(isAuditAdmin('boss@gomagentic.com', ADMINS)).toBe(true)
    expect(isAuditAdmin('OPS@GOMAGENTIC.COM', ADMINS)).toBe(true)
  })

  it('rejects non-admins even when the general allowlist would allow them', () => {
    expect(isAuditAdmin('intern@gomagentic.com', ADMINS)).toBe(false)
  })

  it('rejects everyone when the admin list is empty', () => {
    expect(isAuditAdmin('boss@gomagentic.com', '')).toBe(false)
  })
})
