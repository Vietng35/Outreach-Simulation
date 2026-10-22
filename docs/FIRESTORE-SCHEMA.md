# Firestore Schema

## Overview

All collections use the typed collection pattern — see `frontend/src/lib/firebase/firestore.ts`.
Security rules are in `firebase/firestore.rules`.

When adding a new collection, use the `/firebase-collection` Claude Code skill.

## Schema versioning

Every document in every collection **must** include a `_schemaVersion` field:

```typescript
_schemaVersion: 1  // increment when doing a breaking schema change
```

This enables **lazy migration** — when a document is read, check `_schemaVersion` and migrate on the fly if it's behind current. See the `/evolve-schema` skill for the full migration workflow.

**Rules:**
- `_schemaVersion` is always `1` on creation
- Non-breaking changes (adding optional fields with defaults) keep the same version
- Breaking changes (rename, remove, type change) increment the version and require a migration function
- Never remove `_schemaVersion` from a schema

---

## `users` collection

**Path:** `/users/{userId}`
**Access:** Owner-only (user can read/write their own document; admins can read all)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `uid` | `string` | Yes | Firebase Auth UID (same as document ID) |
| `email` | `string` | Yes | User's email address |
| `displayName` | `string \| null` | Yes | Display name from Auth or profile |
| `photoURL` | `string \| null` | Yes | Profile photo URL |
| `role` | `'user' \| 'admin'` | Yes | User role — immutable by user after creation |
| `createdAt` | `Timestamp` | Yes | When the document was created |
| `updatedAt` | `Timestamp` | Yes | When the document was last updated |
| `_schemaVersion` | `1` | Yes | Schema version for lazy migration |

**Creation:** Auto-created by `AuthProvider` on first sign-in via `syncUserProfile()`.
**Deletion:** Hard-delete is disabled in security rules. Use `deletedAt` field for soft-delete.

---

## Contact outreach collections

Learners email AI-simulated client contacts; each contact can receive at most **3 emails per learner**
(`emailLimit()` in the rules, `EMAIL_LIMIT_PER_CONTACT` in `frontend/src/features/outreach/constants.ts`).
Seed the demo data with `pnpm run seed:outreach`.

### `scenarios`

**Path:** `/scenarios/{scenarioId}` · **Access:** read by any signed-in user; no client writes (seeded)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | `string` | Yes | Scenario title |
| `companyName` | `string` | Yes | Simulated client company |
| `brief` | `string` | Yes | Situation shown to the learner |
| `_schemaVersion` | `1` | Yes | |

### `scenarios/{scenarioId}/contacts`

**Access:** read by any signed-in user; no client writes (seeded)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Contact name |
| `role` | `string` | Yes | Job title |
| `bio` | `string` | Yes | Short public bio (never says who the decision-maker is) |
| `order` | `number` | Yes | Display order |
| `_schemaVersion` | `1` | Yes | |

### `scenarios/{scenarioId}/contactPersonas`

**Access:** server-only — no rule matches, so the default deny applies. Read by the `generateReply` Server Action.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `persona` | `string` | Yes | Prompt describing how the contact behaves (and whether they decide) |
| `_schemaVersion` | `1` | Yes | |

### `engagements`

**Path:** `/engagements/{uid}_{scenarioId}` · **Access:** owner read; owner create (empty); owner update only as part of a send batch

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | `string` | Yes | Learner's UID |
| `scenarioId` | `string` | Yes | Scenario this engagement belongs to |
| `emailCounts` | `map<string, number>` | Yes | contactId → emails sent (0–3) |
| `lastMessageId` | `string` | No | Most recent outbound message — ties each count bump to one message |
| `startedAt` | `Timestamp` | Yes | Server time of first visit |
| `_schemaVersion` | `1` | Yes | |

### `engagements/{engagementId}/messages`

**Access:** owner read; owner create of `outbound` only, in the same batch as the counter bump; never updated or deleted.
`inbound` replies are written by the `generateReply` Server Action (Admin SDK) with ID `{outboundId}_reply`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `contactId` | `string` | Yes | Contact emailed / replying |
| `direction` | `'outbound' \| 'inbound'` | Yes | Learner email or AI reply |
| `subject` | `string` | Yes | 1–120 characters |
| `body` | `string` | Yes | 1–2,000 characters |
| `replyTo` | `string` | Inbound only | ID of the email being answered |
| `createdAt` | `Timestamp` | Yes | Server time |
| `_schemaVersion` | `1` | Yes | |

---

<!-- Add new collection schemas below using the /firebase-collection skill -->
