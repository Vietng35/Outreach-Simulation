'use server'

import { FieldValue } from 'firebase-admin/firestore'
import { requireAuth } from '@/actions/auth.actions'
import { adminDb } from '@/lib/firebase/admin'
import type { ActionResult } from '@/types'
import { BODY_MAX, REPLY_TIMEOUT_MS, SUBJECT_MAX, replyIdFor } from '../constants'
import { generateContactReply, ReplyTimeoutError, type ThreadEntry } from '../lib/gemini'
import { generateReplySchema, type GenerateReplyInput } from '../validation'

/** Leave headroom under the UI's 20 s budget for the Firestore reads and write. */
const GEMINI_TIMEOUT_MS = REPLY_TIMEOUT_MS - 3_000

/**
 * Generate and save the AI contact's reply to one outbound email.
 *
 * Runs on the server: the Gemini key and the contact's persona never reach the
 * browser, and replies are written with the Admin SDK, so learners cannot
 * create or edit them. Idempotent — each email has at most one reply
 * (ID `{outboundId}_reply`), so Retry reply never doubles up or costs an email.
 */
export async function generateReply(
  input: GenerateReplyInput
): Promise<ActionResult<{ replyId: string }>> {
  const session = await requireAuth()

  const parsed = generateReplySchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid input' }
  }
  const { engagementId, outboundId } = parsed.data

  try {
    const engagementRef = adminDb.collection('engagements').doc(engagementId)
    const engagement = await engagementRef.get()
    if (!engagement.exists || engagement.get('userId') !== session.uid) {
      return { success: false, error: 'Email not found' }
    }

    const messages = engagementRef.collection('messages')
    const outbound = await messages.doc(outboundId).get()
    if (!outbound.exists || outbound.get('direction') !== 'outbound') {
      return { success: false, error: 'Email not found' }
    }

    const replyId = replyIdFor(outboundId)
    const replyRef = messages.doc(replyId)
    if ((await replyRef.get()).exists) return { success: true, data: { replyId } }

    const scenarioId = engagement.get('scenarioId') as string
    const contactId = outbound.get('contactId') as string
    const scenarioRef = adminDb.collection('scenarios').doc(scenarioId)
    const [scenario, contact, persona, threadSnap] = await Promise.all([
      scenarioRef.get(),
      scenarioRef.collection('contacts').doc(contactId).get(),
      scenarioRef.collection('contactPersonas').doc(contactId).get(),
      messages.where('contactId', '==', contactId).get(),
    ])
    if (!scenario.exists || !contact.exists) {
      return { success: false, error: 'This contact is no longer available' }
    }

    // Conversation so far with this contact, oldest first, up to the email being answered.
    const outboundTime = outbound.get('createdAt')?.toMillis?.() ?? Date.now()
    const thread: ThreadEntry[] = threadSnap.docs
      .map((d) => ({ id: d.id, time: d.get('createdAt')?.toMillis?.() ?? 0, data: d.data() }))
      .filter((m) => m.time <= outboundTime)
      .sort((a, b) => a.time - b.time)
      .slice(-20)
      .map((m) => ({
        direction: m.data.direction as ThreadEntry['direction'],
        subject: m.data.subject as string,
        body: m.data.body as string,
      }))

    const text = await generateContactReply(
      {
        companyName: scenario.get('companyName'),
        scenarioBrief: scenario.get('brief'),
        contactName: contact.get('name'),
        contactRole: contact.get('role'),
        persona: (persona.get('persona') as string | undefined) ?? '',
        thread,
      },
      GEMINI_TIMEOUT_MS
    )

    const subject = outbound.get('subject') as string
    try {
      await replyRef.create({
        contactId,
        direction: 'inbound',
        subject: (/^re:/i.test(subject) ? subject : `Re: ${subject}`).slice(0, SUBJECT_MAX),
        body: text.slice(0, BODY_MAX),
        replyTo: outboundId,
        createdAt: FieldValue.serverTimestamp(),
        _schemaVersion: 1,
      })
    } catch (err) {
      // 6 = ALREADY_EXISTS: a concurrent retry saved the reply first — that's fine.
      if ((err as { code?: number }).code !== 6) throw err
    }
    return { success: true, data: { replyId } }
  } catch (err) {
    if (err instanceof ReplyTimeoutError) {
      return { success: false, error: 'The reply took too long. Try again.' }
    }
    console.error('generateReply failed', err)
    return { success: false, error: 'Couldn’t generate a reply. Try again.' }
  }
}
