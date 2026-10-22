'use client'

import { useEffect, useState } from 'react'
import { onSnapshot } from 'firebase/firestore'
import { getMessagesCollection } from '@/lib/firebase/firestore'
import type { OutreachMessage } from '@/types/firestore'

export type MessageWithId = OutreachMessage & { id: string }

/** Live list of every message in an engagement, oldest first. */
export function useMessages(engagementId: string | null) {
  const [messages, setMessages] = useState<MessageWithId[]>([])
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!engagementId) return
    return onSnapshot(
      getMessagesCollection(engagementId),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        // A just-sent email has createdAt null until the server confirms it — treat it as newest.
        list.sort(
          (a, b) =>
            (a.createdAt?.toMillis() ?? Number.MAX_SAFE_INTEGER) -
            (b.createdAt?.toMillis() ?? Number.MAX_SAFE_INTEGER)
        )
        setMessages(list)
      },
      (err) => setError(err)
    )
  }, [engagementId])

  return { messages, error }
}
