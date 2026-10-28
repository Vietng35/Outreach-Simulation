import { z } from 'zod'
import { BODY_MAX, SUBJECT_MAX } from './constants'

/**
 * What the learner types into the compose form. The same limits are enforced
 * by isValidOutbound() in firebase/firestore.rules, so a bypassed UI still fails.
 */
export const emailDraftSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(1, 'Add a subject')
    .max(SUBJECT_MAX, `Keep the subject to ${SUBJECT_MAX} characters or fewer`),
  body: z
    .string()
    .trim()
    .min(1, 'Write a message')
    .max(BODY_MAX, `Keep the message to ${BODY_MAX} characters or fewer`),
})

export type EmailDraft = z.infer<typeof emailDraftSchema>

/** Firestore document IDs we build field paths from — no dots, slashes or spaces. */
const docIdSchema = z
  .string()
  .min(1, 'ID is required')
  .max(200)
  .regex(/^[A-Za-z0-9_-]+$/, 'Invalid ID')

export const generateReplySchema = z.object({
  engagementId: docIdSchema,
  outboundId: docIdSchema,
})

export type GenerateReplyInput = z.infer<typeof generateReplySchema>

export { docIdSchema }
