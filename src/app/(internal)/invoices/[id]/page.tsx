import { Suspense } from 'react'
import { InvoiceDetail } from '@/components/invoices/InvoiceDetail'

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <>
      <Suspense>
        <InvoiceDetail id={id} />
      </Suspense>
    </>
  )
}
