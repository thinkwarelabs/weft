import { describe, expect, it } from 'vitest'
import { gstBreakdown, isExport, isIntraState, placeOfSupply } from './gst'

describe('isIntraState', () => {
  it('same Indian state → intra-state', () => {
    expect(isIntraState({ state: 'Haryana', country: 'India' }, { state: 'Haryana', country: 'India' })).toBe(true)
  })
  it('is case- and whitespace-insensitive', () => {
    expect(isIntraState({ state: ' haryana ', country: '' }, { state: 'HARYANA', country: 'india' })).toBe(true)
  })
  it('different states → inter-state', () => {
    expect(isIntraState({ state: 'Haryana', country: 'India' }, { state: 'Karnataka', country: 'India' })).toBe(false)
  })
  it('blank country is treated as India', () => {
    expect(isIntraState({ state: 'Haryana', country: null }, { state: 'Haryana', country: '' })).toBe(true)
  })
  it('foreign client → inter-state (IGST/export)', () => {
    expect(isIntraState({ state: 'Haryana', country: 'India' }, { state: 'Haryana', country: 'United States' })).toBe(false)
  })
  it('blank states fall back to inter-state', () => {
    expect(isIntraState({ state: '', country: 'India' }, { state: '', country: 'India' })).toBe(false)
  })
})

describe('isExport', () => {
  it('foreign client → export', () => {
    expect(isExport({ country: 'India' }, { country: 'United States' })).toBe(true)
  })
  it('domestic and blank-country clients are not exports', () => {
    expect(isExport({ country: 'India' }, { country: 'India' })).toBe(false)
    expect(isExport({ country: '' }, { country: null })).toBe(false)
  })
})

describe('placeOfSupply', () => {
  it('prefers the state code from the client GSTIN', () => {
    expect(placeOfSupply({ state: 'Karnataka', country: 'India', tax_id: '29AACCA1234K1Z9' })).toBe('Karnataka (29)')
  })
  it('falls back to the state-name lookup', () => {
    expect(placeOfSupply({ state: 'Tamil Nadu', country: 'India', tax_id: '' })).toBe('Tamil Nadu (33)')
  })
  it('unknown state prints without a code; blank state is null', () => {
    expect(placeOfSupply({ state: 'Atlantis', country: 'India' })).toBe('Atlantis')
    expect(placeOfSupply({ state: '', country: 'India' })).toBeNull()
  })
})

describe('gstBreakdown', () => {
  it('splits intra-state GST equally into CGST + SGST', () => {
    expect(gstBreakdown(18, 6102, true)).toEqual([
      { label: 'CGST', rate: 9, amount: 3051 },
      { label: 'SGST', rate: 9, amount: 3051 },
    ])
  })
  it('keeps the halves summing to the exact total on odd amounts', () => {
    const rows = gstBreakdown(18, 100.01, true)
    expect(rows).toEqual([
      { label: 'CGST', rate: 9, amount: 50.01 },
      { label: 'SGST', rate: 9, amount: 50 },
    ])
    expect(rows[0].amount + rows[1].amount).toBeCloseTo(100.01, 2)
  })
  it('halves odd rates cleanly', () => {
    expect(gstBreakdown(5, 50, true)[0]).toEqual({ label: 'CGST', rate: 2.5, amount: 25 })
  })
  it('inter-state → single IGST row at the full rate', () => {
    expect(gstBreakdown(18, 6102, false)).toEqual([{ label: 'IGST', rate: 18, amount: 6102 }])
  })
  it('zero rate → no tax rows', () => {
    expect(gstBreakdown(0, 0, true)).toEqual([])
  })
})
