import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight, Briefcase } from 'lucide-react'
import { requireAuth } from '@/actions/auth.actions'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { adminDb } from '@/lib/firebase/admin'

export const metadata: Metadata = { title: 'Client outreach' }

export default async function OutreachScenariosPage() {
  await requireAuth()
  const snap = await adminDb.collection('scenarios').orderBy('title').get()
  const scenarios = snap.docs.map((d) => ({
    id: d.id,
    title: d.get('title') as string,
    companyName: d.get('companyName') as string,
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Client outreach"
        description="Pick a client scenario, then decide who to contact first."
      />
      {scenarios.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No scenarios yet"
          description="Run pnpm run seed:outreach to add the demo scenario."
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {scenarios.map((s) => (
            <li key={s.id}>
              <Link
                href={`/outreach/${s.id}`}
                className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
              >
                <div>
                  <p className="text-sm font-medium">{s.title}</p>
                  <p className="text-xs text-zinc-500">{s.companyName}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-zinc-400" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
