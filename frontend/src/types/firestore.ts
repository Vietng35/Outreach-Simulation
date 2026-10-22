import type { Timestamp } from 'firebase/firestore'

/**
 * Firestore collection type definitions.
 *
 * Keep in sync with:
 *   - src/lib/firebase/firestore.ts  (typed collection exports)
 *   - firebase/firestore.rules       (security rules)
 *   - docs/FIRESTORE-SCHEMA.md       (schema documentation)
 *
 * When adding a new collection, use the /firebase-collection skill.
 */

export interface UserProfile {
  uid: string
  email: string
  displayName: string | null
  photoURL: string | null
  role: 'user'
  createdAt: Timestamp
  updatedAt: Timestamp
  _schemaVersion: 1
}

export type CreateUserProfileInput = Omit<UserProfile, 'createdAt' | 'updatedAt'>

// ── Contact outreach feature ─────────────────────────────────────────────────
// scenarios/{scenarioId}                      — seeded by scripts/seed-outreach.mjs
// scenarios/{scenarioId}/contacts/{contactId} — seeded, readable by signed-in users
// scenarios/{scenarioId}/contactPersonas/{id} — seeded, server-only (rules deny all)
// engagements/{uid}_{scenarioId}              — one per learner per scenario
// engagements/{id}/messages/{messageId}       — outbound (client) + inbound (server)

export interface Scenario {
  title: string
  companyName: string
  brief: string
  _schemaVersion: 1
}

export interface Contact {
  name: string
  role: string
  bio: string
  order: number
  _schemaVersion: 1
}

/** Server-only. Never readable from the browser — holds the AI persona prompt. */
export interface ContactPersona {
  persona: string
  _schemaVersion: 1
}

export interface Engagement {
  userId: string
  scenarioId: string
  /** contactId → number of emails the learner has sent to that contact (max 3). */
  emailCounts: Record<string, number>
  /** ID of the most recent outbound message — lets the rules tie each count bump to one message. */
  lastMessageId?: string
  startedAt: Timestamp
  _schemaVersion: 1
}

export interface OutreachMessage {
  contactId: string
  direction: 'outbound' | 'inbound'
  subject: string
  body: string
  /** Inbound only: the outbound message this reply answers. */
  replyTo?: string
  /** Null for a moment while a local write waits for the server timestamp. */
  createdAt: Timestamp | null
  _schemaVersion: 1
}
