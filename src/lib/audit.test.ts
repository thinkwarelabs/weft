import { describe, expect, it } from 'vitest'
import { buildAuditRow } from './audit'

describe('buildAuditRow', () => {
  it('maps input plus request context into a row', () => {
    const row = buildAuditRow(
      { action: 'invoice.finalize', entityType: 'invoice', entityId: 'abc', metadata: { total: 100 } },
      { actorEmail: 'a@b.com', ip: '1.2.3.4' }
    )
    expect(row).toEqual({
      actor_email: 'a@b.com',
      action: 'invoice.finalize',
      entity_type: 'invoice',
      entity_id: 'abc',
      metadata: { total: 100 },
      ip: '1.2.3.4',
    })
  })

  it('stringifies numeric entity ids (e.g. settings id=1)', () => {
    expect(buildAuditRow({ action: 'settings.update', entityType: 'settings', entityId: 1 }).entity_id).toBe('1')
  })

  it('defaults optional fields to null when absent', () => {
    expect(buildAuditRow({ action: 'client.create' })).toEqual({
      actor_email: null,
      action: 'client.create',
      entity_type: null,
      entity_id: null,
      metadata: null,
      ip: null,
    })
  })

  it('prefers explicit input actor/ip over the request context', () => {
    const row = buildAuditRow(
      { action: 'x', actorEmail: 'explicit@b.com', ip: '9.9.9.9' },
      { actorEmail: 'ctx@b.com', ip: '1.1.1.1' }
    )
    expect(row.actor_email).toBe('explicit@b.com')
    expect(row.ip).toBe('9.9.9.9')
  })
})
