import { describe, expect, it } from 'vitest'
import { rankHits, sanitizeContains, toTsQuery, type SearchHit } from './search'

describe('toTsQuery', () => {
  it('makes the last word a prefix so results appear while typing', () => {
    // Without this, nothing matches until you finish a word and the box feels
    // broken.
    expect(toTsQuery('acm')).toBe('acm:*')
    expect(toTsQuery('acme redesign')).toBe('acme & redesign:*')
  })

  it('lowercases and collapses whitespace', () => {
    expect(toTsQuery('  Acme   Corp  ')).toBe('acme & corp:*')
  })

  it('strips tsquery operators rather than passing them through', () => {
    // & | ! ( ) : * would otherwise be parsed as operators and throw.
    expect(toTsQuery('a & b')).toBe('a & b:*')
    expect(toTsQuery('foo|bar')).toBe('foo & bar:*')
    expect(toTsQuery('(net)')).toBe('net:*')
    expect(toTsQuery("o'brien")).toBe('o & brien:*')
    expect(toTsQuery('back\\slash')).toBe('back & slash:*')
  })

  it('returns empty for nothing searchable', () => {
    // Callers must treat '' as "no query" — handing it to Postgres is an error.
    expect(toTsQuery('')).toBe('')
    expect(toTsQuery('   ')).toBe('')
    expect(toTsQuery('&|!()')).toBe('')
  })
})

describe('sanitizeContains', () => {
  it('trims and collapses, leaving the term intact', () => {
    expect(sanitizeContains('  Acme   Corp ')).toBe('Acme Corp')
    // Identifiers must survive: full-text search tokenises TWL-0004 into
    // pieces, so names and invoice numbers use substring matching instead.
    expect(sanitizeContains('TWL-0004')).toBe('TWL-0004')
    expect(sanitizeContains('user@example.com')).toBe('user@example.com')
  })
})

describe('rankHits', () => {
  const hit = (title: string): SearchHit => ({
    kind: 'client',
    id: title,
    title,
    subtitle: null,
    href: '/',
  })

  it('puts an exact match first, then prefix, then contains', () => {
    const ranked = rankHits([hit('Nimbus'), hit('Acme Corp'), hit('Acme'), hit('The Acme Co')], 'acme')
    expect(ranked.map((h) => h.title)).toEqual(['Acme', 'Acme Corp', 'The Acme Co', 'Nimbus'])
  })

  it('is alphabetical within a tier', () => {
    const ranked = rankHits([hit('Zeta Acme'), hit('Alpha Acme')], 'acme')
    expect(ranked.map((h) => h.title)).toEqual(['Alpha Acme', 'Zeta Acme'])
  })

  it('does not mutate the input', () => {
    const input = [hit('B'), hit('A')]
    rankHits(input, 'a')
    expect(input.map((h) => h.title)).toEqual(['B', 'A'])
  })
})
