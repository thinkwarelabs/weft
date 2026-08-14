import { NextResponse } from 'next/server'
import { db, json } from '@/lib/db'
import { projectInput } from '@/lib/validation'
import { logAudit } from '@/lib/audit'
import { requireInternal, toResponse } from '@/lib/auth/internal'
import { serializeProject } from '@/lib/serialize'
import { defaultChecklist } from '@/lib/onboarding'
import { uniqueProjectSlug } from '@/lib/projects'
import type { Prisma } from '@/generated/prisma/client'

export async function GET(req: Request) {
  try {
    await requireInternal()

    const params = new URL(req.url).searchParams
    const clientId = params.get('clientId')?.trim()
    const includeArchived = params.get('includeArchived') === '1'

    const where: Prisma.ProjectWhereInput = {
      ...(clientId ? { clientId } : {}),
      ...(includeArchived ? {} : { archivedAt: null }),
    }

    const projects = await db.project.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: {
        client: { select: { id: true, name: true } },
        _count: { select: { invoices: true, entries: true } },
      },
    })

    return NextResponse.json({
      projects: projects.map((p) => ({
        ...serializeProject(p),
        client: p.client,
        counts: { invoices: p._count.invoices, entries: p._count.entries },
      })),
    })
  } catch (error) {
    return toResponse(error)
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requireInternal()

    const parsed = projectInput.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }
    const d = parsed.data

    const client = await db.client.findUnique({
      where: { id: d.client_id },
      select: { id: true, name: true },
    })
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

    const project = await db.$transaction(async (tx) => {
      const slug = await uniqueProjectSlug(tx, client.name, d.name)
      return tx.project.create({
        data: {
          clientId: d.client_id,
          name: d.name,
          slug,
          status: d.status,
          // Seeded from the template so the checklist exists from creation
          // rather than materialising on first view.
          onboarding: json(defaultChecklist()),
        },
      })
    })

    await logAudit({
      action: 'project.create',
      entityType: 'project',
      entityId: project.id,
      metadata: { name: project.name, client: client.name, by: actor.email },
    })

    return NextResponse.json({ project: serializeProject(project) }, { status: 201 })
  } catch (error) {
    return toResponse(error)
  }
}
