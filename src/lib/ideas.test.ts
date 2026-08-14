import { describe, expect, it } from 'vitest'
import {
  DELETE_WINDOW_MS,
  buildThread,
  canDeleteIdea,
  deleteWindowRemainingMs,
  isValidReplyTarget,
} from './ideas'

const NOW = new Date('2026-08-13T12:00:00.000Z')
const ago = (ms: number) => new Date(NOW.getTime() - ms)

describe('canDeleteIdea', () => {
  it('lets the author remove a fresh idea', () => {
    expect(canDeleteIdea({ authorId: 'u1', createdAt: ago(60_000) }, 'u1', NOW)).toBe(true)
  })

  it('refuses once the window has passed', () => {
    expect(
      canDeleteIdea({ authorId: 'u1', createdAt: ago(DELETE_WINDOW_MS + 1) }, 'u1', NOW)
    ).toBe(false)
  })

  it('is exclusive at the boundary', () => {
    expect(
      canDeleteIdea({ authorId: 'u1', createdAt: ago(DELETE_WINDOW_MS - 1) }, 'u1', NOW)
    ).toBe(true)
    expect(canDeleteIdea({ authorId: 'u1', createdAt: ago(DELETE_WINDOW_MS) }, 'u1', NOW)).toBe(
      false
    )
  })

  it('refuses someone else, however recent', () => {
    expect(canDeleteIdea({ authorId: 'u1', createdAt: NOW }, 'u2', NOW)).toBe(false)
  })

  it('refuses an idea with no author recorded', () => {
    expect(canDeleteIdea({ authorId: '', createdAt: NOW }, '', NOW)).toBe(false)
  })

  it('refuses a future-dated idea', () => {
    expect(
      canDeleteIdea({ authorId: 'u1', createdAt: new Date(NOW.getTime() + 5_000) }, 'u1', NOW)
    ).toBe(false)
  })
})

describe('deleteWindowRemainingMs', () => {
  it('counts down and floors at zero', () => {
    expect(deleteWindowRemainingMs(NOW, NOW)).toBe(DELETE_WINDOW_MS)
    expect(deleteWindowRemainingMs(ago(DELETE_WINDOW_MS * 2), NOW)).toBe(0)
  })
})

describe('isValidReplyTarget', () => {
  it('accepts a parent on the same idea', () => {
    expect(isValidReplyTarget({ ideaId: 'i1' }, 'i1')).toBe(true)
  })

  it('rejects a parent from a different idea', () => {
    // Otherwise a crafted parentId grafts a thread onto someone else's idea.
    expect(isValidReplyTarget({ ideaId: 'i2' }, 'i1')).toBe(false)
  })

  it('rejects a missing parent', () => {
    expect(isValidReplyTarget(null, 'i1')).toBe(false)
    expect(isValidReplyTarget(undefined, 'i1')).toBe(false)
  })
})

describe('buildThread', () => {
  const c = (id: string, parentId: string | null = null) => ({ id, parentId })

  it('returns flat comments as roots', () => {
    const tree = buildThread([c('a'), c('b')])
    expect(tree.map((t) => t.node.id)).toEqual(['a', 'b'])
    expect(tree.every((t) => t.replies.length === 0)).toBe(true)
  })

  it('nests replies under their parent', () => {
    const tree = buildThread([c('a'), c('b', 'a'), c('c', 'a')])
    expect(tree).toHaveLength(1)
    expect(tree[0]!.replies.map((r) => r.node.id)).toEqual(['b', 'c'])
  })

  it('nests arbitrarily deep', () => {
    const tree = buildThread([c('a'), c('b', 'a'), c('c', 'b')])
    expect(tree[0]!.replies[0]!.replies[0]!.node.id).toBe('c')
  })

  it('promotes orphans rather than dropping them', () => {
    // Losing a comment because its parent is missing would be worse than
    // showing it slightly out of place.
    const tree = buildThread([c('a'), c('orphan', 'missing-parent')])
    expect(tree.map((t) => t.node.id).sort()).toEqual(['a', 'orphan'])
  })

  it('handles an empty list', () => {
    expect(buildThread([])).toEqual([])
  })

  it('keeps every comment exactly once', () => {
    const input = [c('a'), c('b', 'a'), c('c', 'b'), c('d'), c('e', 'x')]
    const seen: string[] = []
    const walk = (nodes: ReturnType<typeof buildThread<(typeof input)[number]>>) => {
      for (const n of nodes) {
        seen.push(n.node.id)
        walk(n.replies)
      }
    }
    walk(buildThread(input))
    expect(seen.sort()).toEqual(['a', 'b', 'c', 'd', 'e'])
  })
})
