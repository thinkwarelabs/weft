import { describe, expect, it } from 'vitest'
import { formatDateLong } from './dates'

describe('formatDateLong', () => {
  it('formats ISO dates like the template', () => {
    expect(formatDateLong('2026-07-10')).toBe('July 10, 2026')
    expect(formatDateLong('2026-01-01')).toBe('January 1, 2026')
  })
})
