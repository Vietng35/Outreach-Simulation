import {
  collection,
  doc,
  FieldPath,
  getDoc,
  increment,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore'
import { getClientDb } from '@/lib/firebase/client'
import { engagementId as toEngagementId } from '@/lib/firebase/firestore'
import { emailDraftSchema, type EmailDraft } from '../validation'

/**
 * Create the learner's engagement for a scenario on first visit.
 * Safe to call repeatedly — it only writes when the document is missing.
 */
export async function ensureEngagement(uid: string, scenarioId: string): Promise<string> {
  const db = getClientDb()
  const id = toEngagementId(uid, scenarioId)
  const ref = doc(db, 'engagements', id)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    await setDoc(ref, {
      userId: uid,
      scenarioId,
      emailCounts: {},
      startedAt: serverTimestamp(),
      _schemaVersion: 1,
    })
  }
  return id
}

/** Reserve a message ID before sending, so the UI can track the email from the start. */
export function newOutreachMessageId(engagementId: string): string {
  return doc(collection(getClientDb(), 'engagements', engagementId, 'messages')).id
}

export type SendResult =
  | { success: true; messageId: string }
  | { success: false; error: string; reason: 'invalid' | 'limit' | 'failed' }

/**
 * Send one outreach email.
 *
 * Writes the message and bumps that contact's counter in ONE atomic batch.
 * firestore.rules only accept the batch as a pair (see isCountedSend), so the
 * 3-email limit holds even if someone bypasses this function.
 */
export async function sendOutreachEmail(params: {
  engagementId: string
  contactId: string
  draft: EmailDraft
  /** From newOutreachMessageId(); a fresh ID is generated if omitted. */
  messageId?: string
}): Promise<SendResult> {
  const parsed = emailDraftSchema.safeParse(params.draft)
  if (!parsed.success) {
    return {
      success: false,
      reason: 'invalid',
      error: parsed.error.errors[0]?.message ?? 'Check your email and try again',
    }
  }

  const db = getClientDb()
  const engagementRef = doc(db, 'engagements', params.engagementId)
  const messages = collection(engagementRef, 'messages')
  const messageRef = params.messageId ? doc(messages, params.messageId) : doc(messages)

  const batch = writeBatch(db)
  batch.set(messageRef, {
    contactId: params.contactId,
    direction: 'outbound',
    subject: parsed.data.subject,
    body: parsed.data.body,
    createdAt: serverTimestamp(),
    _schemaVersion: 1,
  })
  batch.update(
    engagementRef,
    new FieldPath('emailCounts', params.contactId),
    increment(1),
    'lastMessageId',
    messageRef.id
  )

  try {
    await batch.commit()
    return { success: true, messageId: messageRef.id }
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === 'permission-denied') {
      // The rules said no — almost always because this contact is already at the limit.
      return {
        success: false,
        reason: 'limit',
        error: 'This email was not sent. You may have used all your emails to this contact.',
      }
    }
    return {
      success: false,
      reason: 'failed',
      error: 'Couldn’t send your email. Check your connection and try again.',
    }
  }
}
