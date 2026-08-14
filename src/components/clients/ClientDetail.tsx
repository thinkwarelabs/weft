'use client'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { formatDateLong } from '@/lib/dates'
import type { Client, ClientContact, Project } from '@/lib/types'
import { ProjectFormModal } from '@/components/projects/ProjectFormModal'
import { ContactFormModal } from './ContactFormModal'
import { ProjectStatusBadge } from '@/components/projects/ProjectStatusBadge'

export function ClientDetail({ client }: { client: Client }) {
  const [projects, setProjects] = useState<Project[] | null>(null)
  const [contacts, setContacts] = useState<ClientContact[] | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [projectModal, setProjectModal] = useState(false)
  const [contactModal, setContactModal] = useState<{ editing: ClientContact | null } | null>(null)
  const { toast } = useToast()

  const refresh = useCallback(() => setReloadKey((k) => k + 1), [])

  useEffect(() => {
    const ac = new AbortController()
    Promise.all([
      fetch(`/api/projects?clientId=${client.id}`, { signal: ac.signal }).then((r) => r.json()),
      fetch(`/api/contacts?clientId=${client.id}&includeInactive=1`, { signal: ac.signal }).then(
        (r) => r.json()
      ),
    ])
      .then(([p, c]) => {
        setProjects(p.projects ?? [])
        setContacts(c.contacts ?? [])
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return
        toast('Failed to load client details', 'error')
      })
    return () => ac.abort()
  }, [client.id, reloadKey, toast])

  async function setContactActive(contact: ClientContact, active: boolean) {
    const res = await fetch(`/api/contacts/${contact.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    })
    if (res.ok) {
      refresh()
      // Deactivating is the revocation lever: the token check re-reads
      // contact.active on every request, so any open feedback session for this
      // person stops working on their next click.
      toast(active ? 'Contact reactivated' : 'Contact deactivated — their feedback links stop working')
    } else {
      toast('Failed to update contact', 'error')
    }
  }

  if (!projects || !contacts) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner className="size-10 text-zinc-400" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {/* ---------------------------------------------------------------- */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Projects</h2>
            <p className="text-sm text-zinc-500">
              Each engagement is its own project. Invoices, timeline and feedback all hang off one.
            </p>
          </div>
          <Button onClick={() => setProjectModal(true)}>New project</Button>
        </div>

        {projects.length === 0 ? (
          <EmptyState
            title="No projects yet"
            hint="Create one to start tracking onboarding and, later, client feedback."
            action={<Button onClick={() => setProjectModal(true)}>New project</Button>}
          />
        ) : (
          <Card className="overflow-hidden p-0">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                  <th className="w-full px-4 py-3">Project</th>
                  <th className="whitespace-nowrap px-4 py-3">Status</th>
                  <th className="whitespace-nowrap px-4 py-3">Onboarding</th>
                  <th className="whitespace-nowrap px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-50">
                    <td className="border-b border-zinc-100 px-4 py-3 text-sm">
                      <Link href={`/projects/${p.id}`} className="font-medium hover:underline">
                        {p.name}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap border-b border-zinc-100 px-4 py-3 text-sm">
                      <ProjectStatusBadge status={p.status} />
                    </td>
                    <td className="whitespace-nowrap border-b border-zinc-100 px-4 py-3 text-sm text-zinc-600">
                      {p.onboarding_progress.done}/{p.onboarding_progress.total}
                      {p.onboarding_progress.complete && ' ✓'}
                    </td>
                    <td className="whitespace-nowrap border-b border-zinc-100 px-4 py-3 text-sm text-zinc-500">
                      {formatDateLong(p.created_at.slice(0, 10))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      {/* ---------------------------------------------------------------- */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Contacts</h2>
            <p className="text-sm text-zinc-500">
              People who can be sent a feedback link. Separate from the billing email on the
              invoice.
            </p>
          </div>
          <Button onClick={() => setContactModal({ editing: null })}>Add contact</Button>
        </div>

        {contacts.length === 0 ? (
          <EmptyState
            title="No contacts yet"
            hint="Add the people you'd ask for feedback on delivered work."
            action={<Button onClick={() => setContactModal({ editing: null })}>Add contact</Button>}
          />
        ) : (
          <Card className="overflow-hidden p-0">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                  <th className="w-full px-4 py-3">Name</th>
                  <th className="whitespace-nowrap px-4 py-3">Email</th>
                  <th className="whitespace-nowrap px-4 py-3">Role</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.id} className={c.active ? 'hover:bg-zinc-50' : 'bg-zinc-50/60'}>
                    <td className="border-b border-zinc-100 px-4 py-3 text-sm">
                      <span className={c.active ? '' : 'text-zinc-400 line-through'}>{c.name}</span>
                      {!c.active && (
                        <span className="ml-2 text-xs text-zinc-400">no access</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap border-b border-zinc-100 px-4 py-3 text-sm text-zinc-600">
                      {c.email}
                    </td>
                    <td className="whitespace-nowrap border-b border-zinc-100 px-4 py-3 text-sm text-zinc-500">
                      {c.title || '—'}
                    </td>
                    <td className="whitespace-nowrap border-b border-zinc-100 px-4 py-3 text-sm">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          className="h-7 px-2"
                          onClick={() => setContactModal({ editing: c })}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          className="h-7 px-2"
                          onClick={() => setContactActive(c, !c.active)}
                        >
                          {c.active ? 'Deactivate' : 'Reactivate'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      {projectModal && (
        <ProjectFormModal
          clientId={client.id}
          onClose={() => setProjectModal(false)}
          onSaved={() => {
            setProjectModal(false)
            refresh()
          }}
        />
      )}

      {contactModal && (
        <ContactFormModal
          key={contactModal.editing?.id ?? 'new'}
          clientId={client.id}
          initial={contactModal.editing}
          onClose={() => setContactModal(null)}
          onSaved={() => {
            setContactModal(null)
            refresh()
          }}
        />
      )}
    </div>
  )
}
