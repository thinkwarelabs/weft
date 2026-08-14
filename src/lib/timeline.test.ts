import { describe, expect, it } from 'vitest'
import {
  DELETE_WINDOW_MS,
  canDeleteEntry,
  deleteWindowRemainingMs,
  isClientVisible,
  type DeletableEntry,
} from './timeline'

const NOW = new Date('2026-08-13T12:00:00.000Z')
const ago = (ms: number) => new Date(NOW.getTime() - ms)

function entry(over: Partial<DeletableEntry> = {}): DeletableEntry {
  return {
    authorType: 'internal',
    authorUserId: 'user-1',
    createdAt: ago(60_000),
    ...over,
  }
}

describe('canDeleteEntry', () => {
  it('lets the author remove a fresh internal note', () => {
    expect(canDeleteEntry(entry(), 'user-1', NOW)).toBe(true)
  })

  it('refuses once the window has passed', () => {
    expect(canDeleteEntry(entry({ createdAt: ago(DELETE_WINDOW_MS + 1) }), 'user-1', NOW)).toBe(false)
  })

  it('is exclusive at the boundary', () => {
    expect(canDeleteEntry(entry({ createdAt: ago(DELETE_WINDOW_MS - 1) }), 'user-1', NOW)).toBe(true)
    expect(canDeleteEntry(entry({ createdAt: ago(DELETE_WINDOW_MS) }), 'user-1', NOW)).toBe(false)
  })

  it('refuses someone else, however recent', () => {
    expect(canDeleteEntry(entry({ createdAt: NOW }), 'user-2', NOW)).toBe(false)
  })

  it('never lets an internal user delete client feedback', () => {
    // A client's feedback is their own words. Being able to remove it from the
    // record would make the timeline worthless as a record, so authorship and
    // recency do not matter here.
    const feedback = entry({ authorType: 'client', authorUserId: null, createdAt: NOW })
    expect(canDeleteEntry(feedback, 'user-1', NOW)).toBe(false)
  })

  it('refuses an internal entry with no author recorded', () => {
    expect(canDeleteEntry(entry({ authorUserId: null }), 'user-1', NOW)).toBe(false)
  })

  it('refuses an entry dated in the future', () => {
    // Clock skew shouldn't open the window early.
    expect(canDeleteEntry(entry({ createdAt: new Date(NOW.getTime() + 5_000) }), 'user-1', NOW)).toBe(
      false,
    )
  })
})

describe('deleteWindowRemainingMs', () => {
  it('counts down and floors at zero', () => {
    expect(deleteWindowRemainingMs(NOW, NOW)).toBe(DELETE_WINDOW_MS)
    expect(deleteWindowRemainingMs(ago(60_000), NOW)).toBe(DELETE_WINDOW_MS - 60_000)
    expect(deleteWindowRemainingMs(ago(DELETE_WINDOW_MS * 2), NOW)).toBe(0)
  })
})

describe('isClientVisible', () => {
  it('admits only feedback and milestones', () => {
    expect(isClientVisible('feedback')).toBe(true)
    expect(isClientVisible('milestone')).toBe(true)
  })

  it('keeps internal kinds out', () => {
    // If a new kind is added, it must be opted in explicitly — this test fails
    // closed rather than exposing it by default.
    expect(isClientVisible('note')).toBe(false)
    expect(isClientVisible('status_change')).toBe(false)
    expect(isClientVisible('anything_new')).toBe(false)
  })
})
