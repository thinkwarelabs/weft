import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireInternal, toResponse } from '@/lib/auth/internal'
import { rankHits, sanitizeContains, toTsQuery, type SearchHit } from '@/lib/search'

// Cross-entity search behind the command palette.
//
// Two different matching strategies, on purpose:
//
//   NAMES AND IDENTIFIERS use substring matching. Full-text search tokenises,
//   which is right for prose and wrong for "TWL-0004" — the parser splits it
//   and nobody types a whole client name to find one anyway.
//
//   BODIES use the tsvector columns. Those generated columns and their GIN
//   indexes have existed since the first migration and until now nothing
//   queried them; a timeline entry mentioning "staging" was unfindable.
//
// Everything here is internal-only. Ideas and timeline entries are team space
// and must never reach the client surface — which is why this lives under
// /api and not /f, where the ESLint zone would refuse the import anyway.

const PER_KIND = 5

export async function GET(req: Request) {
  try {
    await requireInternal()

    const raw = new URL(req.url).searchParams.get('q') ?? ''
    const term = sanitizeContains(raw)
    if (term.length < 2) return NextResponse.json({ hits: [] })

    const tsq = toTsQuery(term)
    const insensitive = { contains: term, mode: 'insensitive' as const }

    const [clients, projects, invoices, entries, ideas] = await Promise.all([
      db.client.findMany({
        where: {
          archived: false,
          OR: [{ name: insensitive }, { billingEmail: insensitive }],
        },
        take: PER_KIND,
        select: { id: true, name: true, city: true, country: true },
      }),

      db.project.findMany({
        where: { archivedAt: null, name: insensitive },
        take: PER_KIND,
        select: { id: true, name: true, status: true, client: { select: { name: true } } },
      }),

      db.invoice.findMany({
        where: {
          OR: [{ invoiceNumber: insensitive }, { client: { name: insensitive } }],
        },
        orderBy: { createdAt: 'desc' },
        take: PER_KIND,
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          client: { select: { name: true } },
        },
      }),

      // Full-text. An empty tsquery is an error in Postgres, so skip the query
      // entirely rather than passing one.
      tsq
        ? db.$queryRaw<{ id: string; body: string; project_id: string; project_name: string }[]>`
            SELECT e.id, e.body, e.project_id, p.name AS project_name
            FROM timeline_entries e
            JOIN projects p ON p.id = e.project_id
            WHERE e.search_vector @@ to_tsquery('english', ${tsq})
            ORDER BY ts_rank(e.search_vector, to_tsquery('english', ${tsq})) DESC
            LIMIT ${PER_KIND}
          `
        : Promise.resolve([]),

      tsq
        ? db.$queryRaw<{ id: string; title: string }[]>`
            SELECT i.id, i.title
            FROM ideas i
            WHERE i.search_vector @@ to_tsquery('english', ${tsq})
            ORDER BY ts_rank(i.search_vector, to_tsquery('english', ${tsq})) DESC
            LIMIT ${PER_KIND}
          `
        : Promise.resolve([]),
    ])

    const hits: SearchHit[] = [
      ...clients.map((c) => ({
        kind: 'client' as const,
        id: c.id,
        title: c.name,
        subtitle: [c.city, c.country].filter(Boolean).join(', ') || null,
        href: `/clients/${c.id}`,
      })),
      ...projects.map((p) => ({
        kind: 'project' as const,
        id: p.id,
        title: p.name,
        subtitle: `${p.client.name} · ${p.status}`,
        href: `/projects/${p.id}`,
      })),
      ...invoices.map((i) => ({
        kind: 'invoice' as const,
        id: i.id,
        title: i.invoiceNumber ?? 'Draft invoice',
        subtitle: `${i.client.name} · ${i.status}`,
        href: `/invoices/${i.id}`,
      })),
      ...entries.map((e) => ({
        kind: 'timeline' as const,
        id: e.id,
        title: e.body.length > 70 ? `${e.body.slice(0, 70)}…` : e.body,
        subtitle: e.project_name,
        href: `/projects/${e.project_id}`,
      })),
      ...ideas.map((i) => ({
        kind: 'idea' as const,
        id: i.id,
        title: i.title,
        subtitle: null,
        href: `/ideas/${i.id}`,
      })),
    ]

    return NextResponse.json({ hits: rankHits(hits, term) })
  } catch (error) {
    return toResponse(error)
  }
}
