import { describe, expect, it } from 'vitest'
import { pageCount, parsePagination } from './pagination'

function parse(qs: string, opts?: { defaultPageSize?: number; maxPageSize?: number }) {
  return parsePagination(new URLSearchParams(qs), opts)
}

describe('parsePagination', () => {
  it('defaults to page 1 with the default page size when nothing is provided', () => {
    expect(parse('')).toEqual({ page: 1, pageSize: 25, from: 0, to: 24 })
  })

  it('computes the Supabase range for a later page', () => {
    expect(parse('page=3&pageSize=10')).toEqual({ page: 3, pageSize: 10, from: 20, to: 29 })
  })

  it('clamps page to at least 1 for zero, negative and non-numeric values', () => {
    expect(parse('page=0').page).toBe(1)
    expect(parse('page=-5').page).toBe(1)
    expect(parse('page=abc').page).toBe(1)
  })

  it('clamps pageSize to the [1, max] range', () => {
    expect(parse('pageSize=0').pageSize).toBe(1) // provided but invalid -> clamped up to 1
    expect(parse('').pageSize).toBe(25) // absent -> default
    expect(parse('pageSize=9999').pageSize).toBe(100)
    expect(parse('pageSize=5').pageSize).toBe(5)
  })

  it('honours custom default and max page sizes', () => {
    expect(parse('', { defaultPageSize: 50 }).pageSize).toBe(50)
    expect(parse('pageSize=500', { maxPageSize: 200 }).pageSize).toBe(200)
  })
})

describe('pageCount', () => {
  it('returns at least 1 even for an empty result set', () => {
    expect(pageCount(0, 25)).toBe(1)
  })

  it('rounds up partial pages', () => {
    expect(pageCount(26, 25)).toBe(2)
    expect(pageCount(50, 25)).toBe(2)
    expect(pageCount(51, 25)).toBe(3)
  })
})
