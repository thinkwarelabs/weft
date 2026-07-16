import { AppShell } from '@/components/AppShell'
import { BusinessProfileForm } from '@/components/settings/BusinessProfileForm'

export default function SettingsPage() {
  return (
    <AppShell>
      <h1 className="text-2xl font-semibold tracking-tight">Business profile</h1>
      <p className="mt-1 text-sm text-zinc-500">Your business details appear on every invoice you issue.</p>
      <div className="mt-8">
        <BusinessProfileForm />
      </div>
    </AppShell>
  )
}
