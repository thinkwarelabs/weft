import { AppShell } from '@/components/AppShell'
import { ClientsManager } from '@/components/settings/ClientsManager'

export default function ClientsPage() {
  return (
    <AppShell>
      <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
      <p className="mt-1 text-sm text-zinc-500">The people and companies you bill.</p>
      <div className="mt-8">
        <ClientsManager />
      </div>
    </AppShell>
  )
}
