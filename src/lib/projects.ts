import 'server-only'
import { db } from '@/lib/db'
import type { Prisma } from '@/generated/prisma/client'

// Invoice.projectId is REQUIRED — a nullable scope key is one bad query away
// from meaning "all projects", and Project is what every client-facing token is
// scoped to. But the invoice form has no project picker yet, so rather than
// force a two-step flow on a three-person team, a client without a project gets
// a default one created on first invoice.
//
// This keeps the model total (every invoice belongs to an engagement) without
// changing the UI. When the projects UI lands in Step 3, this becomes the
// fallback rather than the norm.

const DEFAULT_PROJECT_NAME = 'General'

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

/**
 * The project an invoice for this client should belong to: their oldest live
 * project, or a newly created "General" one.
 *
 * Takes a transaction client so callers can create the project and the invoice
 * atomically — a project created for an invoice that then fails to insert is
 * a stray row.
 */
export async function ensureDefaultProject(
  tx: Prisma.TransactionClient,
  clientId: string,
): Promise<string> {
  const existing = await tx.project.findFirst({
    where: { clientId, archivedAt: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  if (existing) return existing.id

  const client = await tx.client.findUniqueOrThrow({
    where: { id: clientId },
    select: { name: true },
  })

  // Project.slug is globally unique, so it must carry the client to avoid two
  // customers colliding on "general".
  const base = `${slugify(client.name)}-${slugify(DEFAULT_PROJECT_NAME)}`
  let slug = base
  for (let i = 2; await tx.project.findUnique({ where: { slug }, select: { id: true } }); i++) {
    slug = `${base}-${i}`
  }

  const created = await tx.project.create({
    data: {
      clientId,
      name: DEFAULT_PROJECT_NAME,
      slug,
      status: 'active',
    },
    select: { id: true },
  })
  return created.id
}

/** Non-transactional convenience for read paths. */
export async function findDefaultProject(clientId: string): Promise<string | null> {
  const p = await db.project.findFirst({
    where: { clientId, archivedAt: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  return p?.id ?? null
}
