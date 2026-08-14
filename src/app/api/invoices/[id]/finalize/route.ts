import { NextResponse } from 'next/server'
import { db, num } from '@/lib/db'
import { sendInvoiceGeneratedEmail } from '@/lib/email'
import { buildInvoicePdf } from '@/lib/pdf/buildInvoicePdf'
import { logAudit } from '@/lib/audit'
import { requireInternal, toResponse } from '@/lib/auth/internal'
import {
  serializeBusinessProfile,
  serializeClient,
  serializeInvoice,
} from '@/lib/serialize'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_req: Request, { params }: Ctx) {
  try {
    const actor = await requireInternal()
    const { id } = await params

    const invoice = await db.invoice.findUnique({
      where: { id },
      select: { id: true, status: true, clientId: true, _count: { select: { items: true } } },
    })
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    if (invoice.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft invoices can be finalized' },
        { status: 409 },
      )
    }
    if (invoice._count.items === 0) {
      return NextResponse.json({ error: 'Invoice has no items' }, { status: 400 })
    }

    const [profile, client] = await Promise.all([
      db.businessProfile.findUnique({ where: { id: 1 } }),
      db.client.findUnique({ where: { id: invoice.clientId } }),
    ])
    if (!profile) return NextResponse.json({ error: 'Business profile missing' }, { status: 500 })
    if (!client) return NextResponse.json({ error: 'Client missing' }, { status: 500 })

    const updated = await db.$transaction(async (tx) => {
      // allocate_invoice_number() is plpgsql: UPDATE ... RETURNING takes a row
      // lock, so two concurrent finalizations can never receive the same
      // number. NEVER replace this with a read-then-write in JS — that
      // reintroduces exactly the race the function exists to prevent.
      const rows = await tx.$queryRaw<{ allocate_invoice_number: string }[]>`
        SELECT allocate_invoice_number()
      `
      const invoiceNumber = rows[0]?.allocate_invoice_number
      if (!invoiceNumber) throw new Error('Could not allocate an invoice number')

      return tx.invoice.update({
        where: { id },
        data: {
          invoiceNumber,
          status: 'finalized',
          // Frozen in the SERIALIZED shape, which is what buildInvoicePdf
          // reads. Editing the business profile or the client later must never
          // change a document that has already gone out. Never backfill these.
          businessSnapshot: serializeBusinessProfile(profile),
          clientSnapshot: serializeClient(client),
        },
      })
    })

    await logAudit({
      action: 'invoice.finalize',
      entityType: 'invoice',
      entityId: id,
      metadata: { invoice_number: updated.invoiceNumber, total: num(updated.total) },
    })

    // Notify the team. A failure here must never undo the finalization — the
    // invoice number is already allocated and cannot be handed back.
    try {
      const built = await buildInvoicePdf(id)
      if (built.ok) {
        await sendInvoiceGeneratedEmail({
          invoice: built.invoice,
          client: built.client,
          pdf: built.buffer,
          filename: built.filename,
          generatedBy: actor.email,
        })
      } else {
        console.error(
          `Invoice ${updated.invoiceNumber}: could not build PDF for notification: ${built.error}`,
        )
      }
    } catch (e) {
      console.error(`Invoice ${updated.invoiceNumber}: notification email failed`, e)
    }

    return NextResponse.json({ invoice: serializeInvoice(updated) })
  } catch (error) {
    return toResponse(error)
  }
}
