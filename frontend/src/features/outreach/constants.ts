/**
 * Business rules for contact outreach. The same numbers are enforced in
 * firebase/firestore.rules (emailLimit() and isValidOutbound()) — if you change one, change both.
 */
export const EMAIL_LIMIT_PER_CONTACT = 3
export const SUBJECT_MAX = 120
export const BODY_MAX = 2000
/** How long the UI waits for an AI reply before showing "Retry reply". */
export const REPLY_TIMEOUT_MS = 20_000

/** Inbound replies use a derived ID so each email can only ever get one reply. */
export function replyIdFor(outboundId: string) {
  return `${outboundId}_reply`
}
