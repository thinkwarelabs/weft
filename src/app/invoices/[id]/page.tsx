import { Suspense } from 'react'
import { AppShell } from '@/components/AppShell'
import { InvoiceDetail } from '@/components/invoices/InvoiceDetail'

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <AppShell>
      <Suspense>
        <InvoiceDetail id={id} />
      </Suspense>
    </AppShell>
  )
}
