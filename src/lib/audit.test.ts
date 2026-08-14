import { describe, expect, it } from 'vitest'
import { buildAuditRow } from './audit'

// Row keys are Prisma field names (camelCase) now that logAudit writes through
// db.auditLog.create rather than a raw snake_case insert.
describe('buildAuditRow', () => {
  it('maps input plus request context into a row', () => {
    const row = buildAuditRow(
      { action: 'invoice.finalize', entityType: 'invoice', entityId: 'abc', metadata: { total: 100 } },
      { actorEmail: 'a@b.com', ip: '1.2.3.4' }
    )
    expect(row).toEqual({
      actorType: 'internal',
      actorEmail: 'a@b.com',
      action: 'invoice.finalize',
      entityType: 'invoice',
      entityId: 'abc',
      metadata: { total: 100 },
      ip: '1.2.3.4',
    })
  })

  it('stringifies numeric entity ids (e.g. settings id=1)', () => {
    expect(
      buildAuditRow({ action: 'settings.update', entityType: 'settings', entityId: 1 }).entityId
    ).toBe('1')
  })

  it('defaults optional fields to null when absent', () => {
    expect(buildAuditRow({ action: 'client.create' })).toEqual({
      actorType: 'internal',
      actorEmail: null,
      action: 'client.create',
      entityType: null,
      entityId: null,
      metadata: null,
      ip: null,
    })
  })

  it('prefers explicit input actor/ip over the request context', () => {
    const row = buildAuditRow(
      { action: 'x', actorEmail: 'explicit@b.com', ip: '9.9.9.9' },
      { actorEmail: 'ctx@b.com', ip: '1.1.1.1' }
    )
    expect(row.actorEmail).toBe('explicit@b.com')
    expect(row.ip).toBe('9.9.9.9')
  })

  it('records which side of the trust boundary acted', () => {
    // Client-authored actions (token exchange, feedback submission) must be
    // distinguishable from internal ones in the trail, not inferred from
    // whether actorEmail happens to be null.
    expect(buildAuditRow({ action: 'feedback.submit', actorType: 'client' }).actorType).toBe('client')
    expect(buildAuditRow({ action: 'invoice.create' }).actorType).toBe('internal')
  })
})
