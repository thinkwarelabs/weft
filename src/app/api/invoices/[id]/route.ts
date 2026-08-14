import { NextResponse } from 'next/server'
import { db, num } from '@/lib/db'
import { invoiceInput } from '@/lib/validation'
import { computeTotals, lineBreakdown, preTaxUnitPrice } from '@/lib/money'
import { logAudit } from '@/lib/audit'
import { requireInternal, toResponse } from '@/lib/auth/internal'
import { serializeClient, serializeInvoice, serializeInvoiceItem } from '@/lib/serialize'
import { ensureDefaultProject } from '@/lib/projects'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  try {
    await requireInternal()
    const { id } = await params

    const row = await db.invoice.findUnique({
      where: { id },
      include: { items: { orderBy: { sortOrder: 'asc' } }, client: true },
    })
    if (!row) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

    return NextResponse.json({
      invoice: serializeInvoice(row),
      items: row.items.map(serializeInvoiceItem),
      client: serializeClient(row.client),
    })
  } catch (error) {
    return toResponse(error)
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    await requireInternal()
    const { id } = await params

    const existing = await db.invoice.findUnique({
      where: { id },
      select: { id: true, status: true, clientId: true, projectId: true },
    })
    if (!existing) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    if (existing.status !== 'draft') {
      return NextResponse.json({ error: 'Only draft invoices can be edited' }, { status: 409 })
    }

    const parsed = invoiceInput.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }
    const { items: enteredItems, ...inv } = parsed.data
    const totals = computeTotals(enteredItems, inv.tax_rate)

    // Replace-in-place inside one transaction. The Supabase version deleted the
    // old items, inserted the new ones, and on failure tried to re-insert the
    // old rows and hand-revert twelve columns on the invoice. That restore path
    // was itself unprotected; a failure mid-restore left the invoice mangled.
    // A transaction removes the need for it entirely.
    const invoice = await db.$transaction(async (tx) => {
      await tx.invoiceItem.deleteMany({ where: { invoiceId: id } })

      // If the client changed, the invoice must follow it to a project of the
      // NEW client — leaving the old projectId would scope this invoice to a
      // different customer's engagement, which is exactly the mistake the
      // non-nullable projectId exists to make impossible.
      const projectId =
        inv.client_id === existing.clientId
          ? existing.projectId
          : await ensureDefaultProject(tx, inv.client_id)

      return tx.invoice.update({
        where: { id },
        data: {
          clientId: inv.client_id,
          projectId,
          issueDate: new Date(`${inv.issue_date}T00:00:00.000Z`),
          dueDate: new Date(`${inv.due_date}T00:00:00.000Z`),
          currency: inv.currency,
          taxLabel: inv.tax_label || null,
          taxRate: inv.tax_rate,
          paymentLink: inv.payment_link || null,
          notes: inv.notes || null,
          subtotal: totals.subtotal,
          taxAmount: totals.taxAmount,
          total: totals.total,
          items: {
            create: enteredItems.map((it, i) => ({
              description: it.description,
              period: it.period || null,
              qty: it.qty,
              unitPrice: preTaxUnitPrice(it.unit_price, it.gst_included, inv.tax_rate),
              gstIncluded: it.gst_included,
              enteredUnitPrice: it.unit_price,
              amount: lineBreakdown(it, inv.tax_rate).net,
              sortOrder: i,
            })),
          },
        },
      })
    })

    await logAudit({
      action: 'invoice.update',
      entityType: 'invoice',
      entityId: id,
      metadata: { total: num(invoice.total), currency: invoice.currency },
    })

    return NextResponse.json({ invoice: serializeInvoice(invoice) })
  } catch (error) {
    return toResponse(error)
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    await requireInternal()
    const { id } = await params

    const existing = await db.invoice.findUnique({
      where: { id },
      select: { id: true, status: true },
    })
    if (!existing) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    if (existing.status !== 'draft') {
      return NextResponse.json({ error: 'Only draft invoices can be deleted' }, { status: 409 })
    }

    // Items cascade (onDelete: Cascade on InvoiceItem.invoice).
    await db.invoice.delete({ where: { id } })

    await logAudit({ action: 'invoice.delete', entityType: 'invoice', entityId: id })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return toResponse(error)
  }
}
