import { describe, expect, it } from 'vitest'
import {
  evaluateAccess,
  isAllowed,
  type AccessDecision,
  type TokenSnapshot,
} from './client-access'

const NOW = new Date('2026-08-13T12:00:00.000Z')
const inHours = (h: number) => new Date(NOW.getTime() + h * 3_600_000)

function token(over: Partial<TokenSnapshot> = {}): TokenSnapshot {
  return {
    scope: 'feedback',
    expiresAt: inHours(24),
    revokedAt: null,
    contactActive: true,
    projectArchivedAt: null,
    ...over,
  }
}

describe('evaluateAccess', () => {
  it('admits a live token', () => {
    expect(evaluateAccess(token(), NOW)).toBe('ok')
  })

  it('denies a missing row', () => {
    expect(evaluateAccess(null, NOW)).toBe('not_found')
    expect(evaluateAccess(undefined, NOW)).toBe('not_found')
  })

  it('denies a revoked token however fresh', () => {
    expect(evaluateAccess(token({ revokedAt: NOW, expiresAt: inHours(100) }), NOW)).toBe('revoked')
  })

  it('treats expiry as exclusive', () => {
    // Dead AT the instant, not after it.
    expect(evaluateAccess(token({ expiresAt: NOW }), NOW)).toBe('expired')
    expect(evaluateAccess(token({ expiresAt: new Date(NOW.getTime() + 1) }), NOW)).toBe('ok')
    expect(evaluateAccess(token({ expiresAt: new Date(NOW.getTime() - 1) }), NOW)).toBe('expired')
  })

  it('denies a deactivated contact immediately', () => {
    // The revocation lever: this is re-read every request, so switching a
    // contact off cuts an open session at their next click.
    expect(evaluateAccess(token({ contactActive: false }), NOW)).toBe('contact_inactive')
  })

  it('denies an archived project', () => {
    expect(evaluateAccess(token({ projectArchivedAt: NOW }), NOW)).toBe('project_archived')
  })

  it('denies a token minted for a different capability', () => {
    // Scope is single-valued today, but the check exists so widening the enum
    // later cannot silently grant old tokens new powers.
    expect(evaluateAccess(token({ scope: 'something_else' }), NOW)).toBe('wrong_scope')
    expect(evaluateAccess(token({ scope: 'feedback' }), NOW, 'admin')).toBe('wrong_scope')
  })

  it('fails closed when several conditions are wrong at once', () => {
    const doomed = token({
      revokedAt: NOW,
      expiresAt: new Date(NOW.getTime() - 1),
      contactActive: false,
      projectArchivedAt: NOW,
    })
    expect(isAllowed(evaluateAccess(doomed, NOW))).toBe(false)
  })

  it('only ever says yes to exactly one decision', () => {
    const decisions: AccessDecision[] = [
      'not_found',
      'revoked',
      'expired',
      'contact_inactive',
      'project_archived',
      'wrong_scope',
    ]
    // Nothing except 'ok' may pass. If a new decision is added and someone
    // forgets to deny it, this fails.
    for (const d of decisions) expect(isAllowed(d)).toBe(false)
    expect(isAllowed('ok')).toBe(true)
  })
})
