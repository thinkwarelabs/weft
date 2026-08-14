import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { settingsInput } from '@/lib/validation'
import { logAudit } from '@/lib/audit'
import { requireInternal, toResponse } from '@/lib/auth/internal'
import { serializeBusinessProfile } from '@/lib/serialize'

export async function GET() {
  try {
    await requireInternal()

    // The singleton is seeded by the init migration, so it always exists.
    const profile = await db.businessProfile.findUniqueOrThrow({ where: { id: 1 } })
    return NextResponse.json({ profile: serializeBusinessProfile(profile) })
  } catch (error) {
    return toResponse(error)
  }
}

export async function PATCH(req: Request) {
  try {
    await requireInternal()

    const parsed = settingsInput.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }
    const d = parsed.data

    const profile = await db.businessProfile.update({
      where: { id: 1 },
      data: {
        companyName: d.company_name,
        addressLine1: d.address_line1 || null,
        addressLine2: d.address_line2 || null,
        city: d.city || null,
        state: d.state || null,
        postalCode: d.postal_code || null,
        country: d.country || null,
        email: d.email || null,
        phone: d.phone || null,
        taxId: d.tax_id || null,
        legalNote: d.legal_note || null,
        bankAccountName: d.bank_account_name || null,
        bankName: d.bank_name || null,
        bankAccountNumber: d.bank_account_number || null,
        bankIfsc: d.bank_ifsc || null,
        bankSwift: d.bank_swift || null,
        invoicePrefix: d.invoice_prefix,
        defaultCurrency: d.default_currency,
        defaultTaxLabel: d.default_tax_label || null,
        defaultTaxRate: d.default_tax_rate,
        // updatedAt is @updatedAt — Prisma sets it. Never set it by hand.
      },
    })

    // next_invoice_number is deliberately NOT updatable here. It is claimed
    // only by allocate_invoice_number(); letting Settings write it would
    // reintroduce the duplicate-number race the function exists to prevent.
    await logAudit({
      action: 'settings.update',
      entityType: 'settings',
      entityId: 1,
      metadata: { fields: Object.keys(d) },
    })

    return NextResponse.json({ profile: serializeBusinessProfile(profile) })
  } catch (error) {
    return toResponse(error)
  }
}
