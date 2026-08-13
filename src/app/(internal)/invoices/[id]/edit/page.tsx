import { InvoiceForm } from '@/components/invoices/InvoiceForm'

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Edit invoice</h1>
      <div className="mt-8">
        <InvoiceForm invoiceId={id} />
      </div>
    </>
  )
}
