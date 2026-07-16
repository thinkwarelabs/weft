import { describe, expect, it } from 'vitest'
import { isAllowedEmail } from './allowlist'

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
