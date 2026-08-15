import { NextResponse } from 'next/server'
import { db, num } from '@/lib/db'
import { requireInternal, toResponse } from '@/lib/auth/internal'
import { todayISO } from '@/lib/dates'
import { round2 } from '@/lib/money'
import { checklistProgress, normalizeChecklist } from '@/lib/onboarding'

// The attention feed behind Home.
//
// Everything here is derived from data already stored — nothing new is written
// to make the dashboard work. That matters: a dashboard with its own tables
// drifts from the thing it describes.
//
// The organising question is "what needs me?", not "what exists?". Anything
// that can't answer that belongs on a list page instead.

const STALE_DAYS = 7

export async function GET() {
  try {
    await requireInternal()

    const today = todayISO()
    const todayDate = new Date(`${today}T00:00:00.000Z`)
    const staleBefore = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000)

    const [overdue, drafts, waitingRequests, onboarding, recent] = await Promise.all([
      db.invoice.findMany({
        where: { status: 'finalized', dueDate: { lt: todayDate } },
        orderBy: { dueDate: 'asc' },
        select: {
          id: true,
          invoiceNumber: true,
          dueDate: true,
          currency: true,
          total: true,
          client: { select: { name: true } },
        },
      }),

      db.invoice.count({ where: { status: 'draft' } }),

      // Asked, not yet answered. Age is what makes it actionable.
      db.feedbackRequest.findMany({
        where: { respondedAt: null },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          prompt: true,
          createdAt: true,
          contact: { select: { name: true } },
          project: {
            select: { id: true, name: true, client: { select: { name: true } } },
          },
        },
      }),

      // Projects still onboarding that nobody has touched lately. A checklist
      // half-done and untouched for a week is the shape of a stalled start.
      db.project.findMany({
        where: { status: 'onboarding', archivedAt: null, updatedAt: { lt: staleBefore } },
        orderBy: { updatedAt: 'asc' },
        select: {
          id: true,
          name: true,
          onboarding: true,
          updatedAt: true,
          client: { select: { name: true } },
        },
      }),

      // What happened recently, client replies included.
      db.timelineEntry.findMany({
        orderBy: { createdAt: 'desc' },
        take: 12,
        select: {
          id: true,
          kind: true,
          body: true,
          createdAt: true,
          authorType: true,
          authorUser: { select: { name: true, email: true } },
          authorContact: { select: { name: true } },
          project: {
            select: { id: true, name: true, client: { select: { name: true } } },
          },
        },
      }),
    ])

    // Overdue totals per currency — the studio bills in more than one.
    const overdueByCurrency: Record<string, number> = {}
    for (const inv of overdue) {
      overdueByCurrency[inv.currency] = round2(
        (overdueByCurrency[inv.currency] ?? 0) + num(inv.total),
      )
    }

    return NextResponse.json({
      overdue: {
        count: overdue.length,
        byCurrency: overdueByCurrency,
        invoices: overdue.slice(0, 5).map((inv) => ({
          id: inv.id,
          invoice_number: inv.invoiceNumber,
          client: inv.client.name,
          due_date: inv.dueDate.toISOString().slice(0, 10),
          currency: inv.currency,
          total: num(inv.total),
        })),
      },

      draftCount: drafts,

      waiting: waitingRequests.map((r) => ({
        id: r.id,
        prompt: r.prompt,
        created_at: r.createdAt.toISOString(),
        contact: r.contact.name,
        project: { id: r.project.id, name: r.project.name, client: r.project.client.name },
      })),

      stalledOnboarding: onboarding
        .map((p) => ({
          id: p.id,
          name: p.name,
          client: p.client.name,
          updated_at: p.updatedAt.toISOString(),
          progress: checklistProgress(normalizeChecklist(p.onboarding)),
        }))
        // A completed checklist on a project still marked "onboarding" is a
        // different problem — it just needs its status moving — so keep it.
        .filter((p) => p.progress.total > 0),

      recent: recent.map((e) => ({
        id: e.id,
        kind: e.kind,
        body: e.body.length > 140 ? `${e.body.slice(0, 140)}…` : e.body,
        created_at: e.createdAt.toISOString(),
        author:
          e.authorType === 'client'
            ? (e.authorContact?.name ?? 'Client')
            : (e.authorUser?.name ?? e.authorUser?.email ?? 'Weft'),
        author_type: e.authorType,
        project: { id: e.project.id, name: e.project.name, client: e.project.client.name },
      })),
    })
  } catch (error) {
    return toResponse(error)
  }
}
