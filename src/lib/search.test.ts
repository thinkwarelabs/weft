import { describe, expect, it } from 'vitest'
import { sanitizeIlike } from './search'

describe('sanitizeIlike', () => {
  it('returns empty string for null/undefined/blank', () => {
    expect(sanitizeIlike(null)).toBe('')
    expect(sanitizeIlike(undefined)).toBe('')
    expect(sanitizeIlike('   ')).toBe('')
  })

  it('keeps ordinary search terms intact', () => {
    expect(sanitizeIlike('  Acme Corp ')).toBe('Acme Corp')
    expect(sanitizeIlike('user@example.com')).toBe('user@example.com')
  })

  it('strips characters that would break a PostgREST or()/ilike filter', () => {
    expect(sanitizeIlike('a,b')).toBe('a b')
    expect(sanitizeIlike('name.ilike.*)')).toBe('name.ilike.')
    expect(sanitizeIlike('50% (net)')).toBe('50 net')
    expect(sanitizeIlike('back\\slash')).toBe('back slash')
  })
})
