'use client'

import { useCallback, useMemo, useState } from 'react'
import { AlertCircle, MousePointerClick } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { useCollection } from '@/hooks/useFirestore'
import { useAuth } from '@/hooks/useAuth'
import { getContactsCollection } from '@/lib/firebase/firestore'
import type { Contact } from '@/types/firestore'
import { generateReply } from '../actions/generateReply'
import { EMAIL_LIMIT_PER_CONTACT, REPLY_TIMEOUT_MS } from '../constants'
import { useEngagement } from '../hooks/useEngagement'
import { useMessages } from '../hooks/useMessages'
import { newOutreachMessageId, sendOutreachEmail } from '../lib/sendEmail'
import type { EmailDraft } from '../validation'
import { ComposeForm } from './ComposeForm'
import { ContactList, type ContactSummary } from './ContactList'
import { ThreadView, type ThreadItem } from './ThreadView'

const TIMEOUT_MESSAGE = 'The reply took too long.'

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(TIMEOUT_MESSAGE)), ms)),
  ])
}

/** Remounts the desk (and its listeners) when the learner presses Retry. */
export function OutreachDesk({ scenarioId }: { scenarioId: string }) {
  const [attempt, setAttempt] = useState(0)
  return (
    <OutreachDeskInner
      key={attempt}
      scenarioId={scenarioId}
      onRetry={() => setAttempt((n) => n + 1)}
    />
  )
}

function OutreachDeskInner({ scenarioId, onRetry }: { scenarioId: string; onRetry: () => void }) {
  const { user } = useAuth()
  const contactsRef = useMemo(() => getContactsCollection(scenarioId), [scenarioId])
  const contactsQuery = useCollection(contactsRef)
  // useCollection adds each document's id at runtime
  const contactDocs = contactsQuery.data as (Contact & { id: string })[]
  const { engagementId, engagement, error: engagementError } = useEngagement(user?.uid, scenarioId)
  const { messages, error: messagesError } = useMessages(engagementId)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pendingReplies, setPendingReplies] = useState<Set<string>>(() => new Set())
  const [replyErrors, setReplyErrors] = useState<Record<string, string>>({})

  const contacts: ContactSummary[] = useMemo(
    () =>
      [...contactDocs]
        .sort((a, b) => a.order - b.order)
        .map((c) => ({
          id: c.id,
          name: c.name,
          role: c.role,
          bio: c.bio,
          remaining: EMAIL_LIMIT_PER_CONTACT - (engagement?.emailCounts?.[c.id] ?? 0),
        })),
    [contactDocs, engagement]
  )
  const selected = contacts.find((c) => c.id === selectedId) ?? null

  const setPending = (id: string, on: boolean) =>
    setPendingReplies((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  const requestReply = useCallback(
    async (outboundId: string) => {
      if (!engagementId) return
      setPending(outboundId, true)
      setReplyErrors((prev) => {
        const next = { ...prev }
        delete next[outboundId]
        return next
      })
      try {
        const result = await withTimeout(
          generateReply({ engagementId, outboundId }),
          REPLY_TIMEOUT_MS
        )
        if (!result.success) {
          setReplyErrors((prev) => ({ ...prev, [outboundId]: result.error ?? TIMEOUT_MESSAGE }))
        }
      } catch (err) {
        setReplyErrors((prev) => ({
          ...prev,
          [outboundId]:
            err instanceof Error && err.message === TIMEOUT_MESSAGE
              ? `${TIMEOUT_MESSAGE} Try again.`
              : 'Couldn’t generate a reply. Try again.',
        }))
      } finally {
        setPending(outboundId, false)
      }
    },
    [engagementId]
  )

  async function handleSend(draft: EmailDraft): Promise<string | null> {
    if (!engagementId || !selected) return 'Still loading — try again in a moment.'
    const messageId = newOutreachMessageId(engagementId)
    setPending(messageId, true) // show "typing" as soon as the email appears
    const result = await sendOutreachEmail({
      engagementId,
      contactId: selected.id,
      draft,
      messageId,
    })
    if (!result.success) {
      setPending(messageId, false)
      return result.error
    }
    void requestReply(messageId)
    return null
  }

  const thread: ThreadItem[] = useMemo(() => {
    if (!selected) return []
    const forContact = messages.filter((m) => m.contactId === selected.id)
    const repliedTo = new Set(forContact.filter((m) => m.replyTo).map((m) => m.replyTo))
    return forContact.map((message) => {
      if (message.direction === 'inbound') return { message }
      const replied = repliedTo.has(message.id)
      return {
        message,
        replyStatus: replied ? 'replied' : pendingReplies.has(message.id) ? 'awaiting' : 'failed',
        replyError: replyErrors[message.id],
      }
    })
  }, [messages, selected, pendingReplies, replyErrors])

  const loadError = contactsQuery.error || engagementError || messagesError
  const loadingContacts = contactsQuery.loading || (!engagement && !loadError)

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(260px,320px)_1fr]">
      <section aria-labelledby="contacts-heading" className="space-y-3">
        <h2 id="contacts-heading" className="text-sm font-semibold">
          Client contacts
        </h2>
        <ContactList
          contacts={contacts}
          loading={loadingContacts}
          error={!!loadError}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onRetry={onRetry}
        />
      </section>

      <section
        aria-label="Conversation"
        className="flex min-h-[420px] flex-col rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950"
      >
        {!selected ? (
          <EmptyState
            icon={loadError ? AlertCircle : MousePointerClick}
            title={loadError ? 'This scenario couldn’t be loaded' : 'Choose a contact'}
            description={
              loadError
                ? 'Use Retry on the left.'
                : `Each contact can receive up to ${EMAIL_LIMIT_PER_CONTACT} emails from you, so choose carefully.`
            }
          />
        ) : (
          <>
            <header className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <p className="text-sm font-medium">{selected.name}</p>
              <p className="text-xs text-zinc-500">{selected.role}</p>
            </header>
            <div className="flex-1 overflow-y-auto p-4">
              <ThreadView contactName={selected.name} items={thread} onRetryReply={requestReply} />
            </div>
            <div className="border-t border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <ComposeForm
                key={selected.id}
                contactName={selected.name}
                remaining={selected.remaining}
                onSend={handleSend}
              />
            </div>
          </>
        )}
      </section>
    </div>
  )
}
