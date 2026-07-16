import { AppShell } from '@/components/AppShell'
import { InvoiceForm } from '@/components/invoices/InvoiceForm'

export default function NewInvoicePage() {
  return (
    <AppShell>
      <h1 className="text-2xl font-semibold tracking-tight">New invoice</h1>
      <div className="mt-8">
        <InvoiceForm />
      </div>
    </AppShell>
  )
}
