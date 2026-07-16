'use client'
import { useState } from 'react'
import { cn } from '@/lib/cn'
import { BusinessProfileForm } from './BusinessProfileForm'
import { ClientsManager } from './ClientsManager'

const TABS = [
  { key: 'business', label: 'Business profile' },
  { key: 'clients', label: 'Clients' },
] as const

type TabKey = (typeof TABS)[number]['key']

export function SettingsTabs() {
  const [tab, setTab] = useState<TabKey>('business')

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
              tab === t.key ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'business' ? <BusinessProfileForm /> : <ClientsManager />}
    </div>
  )
}
