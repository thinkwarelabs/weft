import { FinancialsDashboard } from '@/components/financials/FinancialsDashboard'

export default function FinancialsPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Financials</h1>
      <p className="mt-1 text-sm text-zinc-500">Revenue, GST and expenses by period.</p>
      <div className="mt-8">
        <FinancialsDashboard />
      </div>
    </>
  )
}
