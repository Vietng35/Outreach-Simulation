'use client'

import { useEffect, useState } from 'react'
import { onSnapshot } from 'firebase/firestore'
import { engagementDoc } from '@/lib/firebase/firestore'
import type { Engagement } from '@/types/firestore'
import { ensureEngagement } from '../lib/sendEmail'

interface UseEngagementResult {
  engagementId: string | null
  engagement: Engagement | null
  loading: boolean
  error: Error | null
}

/** Create (on first visit) and subscribe to the learner's engagement for a scenario. */
export function useEngagement(uid: string | undefined, scenarioId: string): UseEngagementResult {
  const [engagementId, setEngagementId] = useState<string | null>(null)
  const [engagement, setEngagement] = useState<Engagement | null>(null)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!uid) return
    let unsubscribe: (() => void) | undefined
    let cancelled = false

    ensureEngagement(uid, scenarioId)
      .then((id) => {
        if (cancelled) return
        setEngagementId(id)
        unsubscribe = onSnapshot(
          engagementDoc(id),
          (snap) => setEngagement(snap.exists() ? snap.data() : null),
          (err) => setError(err)
        )
      })
      .catch((err: Error) => !cancelled && setError(err))

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [uid, scenarioId])

  return { engagementId, engagement, loading: !error && !engagement, error }
}
