import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAuth } from '@/actions/auth.actions'
import { PageHeader } from '@/components/layout/PageHeader'
import { OutreachDesk } from '@/features/outreach/components/OutreachDesk'
import { docIdSchema } from '@/features/outreach/validation'
import { adminDb } from '@/lib/firebase/admin'

export const metadata: Metadata = { title: 'Outreach desk' }

// The AI reply Server Action can take several seconds; give it room on Vercel.
export const maxDuration = 30

export default async function OutreachDeskPage({
  params,
}: {
  params: Promise<{ scenarioId: string }>
}) {
  await requireAuth()
  const { scenarioId } = await params
  if (!docIdSchema.safeParse(scenarioId).success) notFound()

  const scenario = await adminDb.collection('scenarios').doc(scenarioId).get()
  if (!scenario.exists) notFound()

  return (
    <div className="space-y-6">
      <Link href="/outreach" className="text-sm text-zinc-500 hover:text-zinc-900">
        ← All scenarios
      </Link>
      <PageHeader
        title={`${scenario.get('companyName')} — ${scenario.get('title')}`}
        description={scenario.get('brief')}
      />
      <OutreachDesk scenarioId={scenarioId} />
    </div>
  )
}
