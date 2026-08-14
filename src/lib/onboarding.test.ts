import { describe, expect, it } from 'vitest'
import {
  CHECKLIST_TEMPLATE,
  checklistProgress,
  defaultChecklist,
  normalizeChecklist,
  setItemDone,
  type ChecklistItem,
} from './onboarding'

const NOW = new Date('2026-08-13T10:00:00.000Z')

describe('defaultChecklist', () => {
  it('mirrors the template with nothing done', () => {
    const list = defaultChecklist()
    expect(list).toHaveLength(CHECKLIST_TEMPLATE.length)
    expect(list.every((i) => i.doneAt === null && i.doneByUserId === null)).toBe(true)
  })
})

describe('normalizeChecklist', () => {
  it('returns a full checklist for null, garbage or a non-array', () => {
    for (const input of [null, undefined, 'nonsense', 42, {}, [1, 2, 3], [{ nope: true }]]) {
      const list = normalizeChecklist(input)
      expect(list).toHaveLength(CHECKLIST_TEMPLATE.length)
      expect(list.every((i) => i.doneAt === null)).toBe(true)
    }
  })

  it('preserves completion state across a reload', () => {
    const stored = setItemDone(defaultChecklist(), 'kickoff', true, 'user-1', NOW)
    const list = normalizeChecklist(stored)
    const kickoff = list.find((i) => i.key === 'kickoff')!
    expect(kickoff.doneAt).toBe(NOW.toISOString())
    expect(kickoff.doneByUserId).toBe('user-1')
  })

  it('adds template items that did not exist when the project started', () => {
    // A project stored before a step was introduced must gain it, not be stuck
    // with a shorter list forever.
    const old: ChecklistItem[] = [
      { key: 'agreement', label: 'Agreement signed', doneAt: NOW.toISOString(), doneByUserId: 'u' },
    ]
    const list = normalizeChecklist(old)
    expect(list).toHaveLength(CHECKLIST_TEMPLATE.length)
    expect(list.find((i) => i.key === 'agreement')!.doneAt).toBe(NOW.toISOString())
    expect(list.find((i) => i.key === 'environment')!.doneAt).toBe(null)
  })

  it('takes labels from the template so wording changes propagate', () => {
    const stale: ChecklistItem[] = [
      { key: 'kickoff', label: 'Old wording', doneAt: null, doneByUserId: null },
    ]
    expect(normalizeChecklist(stale).find((i) => i.key === 'kickoff')!.label).toBe(
      CHECKLIST_TEMPLATE.find((t) => t.key === 'kickoff')!.label,
    )
  })

  it('drops retired items that were never done, but keeps completed ones', () => {
    const stored: ChecklistItem[] = [
      { key: 'retired-untouched', label: 'Gone', doneAt: null, doneByUserId: null },
      { key: 'retired-done', label: 'Was done', doneAt: NOW.toISOString(), doneByUserId: 'u' },
    ]
    const keys = normalizeChecklist(stored).map((i) => i.key)
    expect(keys).not.toContain('retired-untouched')
    // Throwing away the record of work someone actually did is worse than
    // showing a stale row.
    expect(keys).toContain('retired-done')
  })
})

describe('setItemDone', () => {
  it('ticks an item with who and when', () => {
    const list = setItemDone(defaultChecklist(), 'deposit', true, 'user-9', NOW)
    const item = list.find((i) => i.key === 'deposit')!
    expect(item.doneAt).toBe(NOW.toISOString())
    expect(item.doneByUserId).toBe('user-9')
  })

  it('unticking clears both the time and the attribution', () => {
    const done = setItemDone(defaultChecklist(), 'deposit', true, 'user-9', NOW)
    const undone = setItemDone(done, 'deposit', false, 'user-9', NOW)
    const item = undone.find((i) => i.key === 'deposit')!
    expect(item.doneAt).toBe(null)
    expect(item.doneByUserId).toBe(null)
  })

  it('keeps the original completion time and author when ticked again', () => {
    // Two people clicking the same box shouldn't rewrite who finished it.
    const first = setItemDone(defaultChecklist(), 'brief', true, 'user-1', NOW)
    const later = new Date('2026-09-01T00:00:00.000Z')
    const second = setItemDone(first, 'brief', true, 'user-2', later)
    const item = second.find((i) => i.key === 'brief')!
    expect(item.doneAt).toBe(NOW.toISOString())
    expect(item.doneByUserId).toBe('user-1')
  })

  it('does not mutate the input array', () => {
    const original = defaultChecklist()
    setItemDone(original, 'kickoff', true, 'u', NOW)
    expect(original.find((i) => i.key === 'kickoff')!.doneAt).toBe(null)
  })

  it('ignores an unknown key rather than inventing an item', () => {
    const list = setItemDone(defaultChecklist(), 'no-such-step', true, 'u', NOW)
    expect(list).toHaveLength(CHECKLIST_TEMPLATE.length)
    expect(list.every((i) => i.doneAt === null)).toBe(true)
  })
})

describe('checklistProgress', () => {
  it('counts completion and rounds a percentage', () => {
    const list = defaultChecklist()
    expect(checklistProgress(list)).toMatchObject({ done: 0, complete: false, percent: 0 })

    const partly = setItemDone(list, 'agreement', true, 'u', NOW)
    const p = checklistProgress(partly)
    expect(p.done).toBe(1)
    expect(p.total).toBe(CHECKLIST_TEMPLATE.length)
    expect(p.complete).toBe(false)
  })

  it('is complete only when every item is done', () => {
    let list = defaultChecklist()
    for (const t of CHECKLIST_TEMPLATE) list = setItemDone(list, t.key, true, 'u', NOW)
    expect(checklistProgress(list)).toMatchObject({ complete: true, percent: 100 })
  })

  it('handles an empty list without dividing by zero', () => {
    expect(checklistProgress([])).toEqual({ done: 0, total: 0, complete: false, percent: 0 })
  })
})
