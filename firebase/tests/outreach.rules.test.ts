/**
 * Security-rules tests for the contact-outreach feature (AC3, AC5, AC8).
 * Runs against the Firestore emulator:  pnpm run test:rules
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  collection,
  deleteDoc,
  doc,
  FieldPath,
  getDoc,
  getDocs,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const SCENARIO = 's1'
const ALICE = 'alice'
const BOB = 'bob'
const aliceEngagement = `${ALICE}_${SCENARIO}`

let env: RulesTestEnvironment

const dbFor = (uid: string) => env.authenticatedContext(uid).firestore() as unknown as Firestore

function newEngagement(uid: string, overrides: Record<string, unknown> = {}) {
  return {
    userId: uid,
    scenarioId: SCENARIO,
    emailCounts: {},
    startedAt: serverTimestamp(),
    _schemaVersion: 1,
    ...overrides,
  }
}

function outbound(contactId: string, overrides: Record<string, unknown> = {}) {
  return {
    contactId,
    direction: 'outbound',
    subject: 'Introduction',
    body: 'Hello, could we book a short call this week?',
    createdAt: serverTimestamp(),
    _schemaVersion: 1,
    ...overrides,
  }
}

/** The same batch the app sends: new message + counter bump pointing at it. */
function sendBatch(
  db: Firestore,
  contactId: string,
  opts: {
    message?: Record<string, unknown>
    bumpContactId?: string
    by?: number
  } = {}
) {
  const engRef = doc(db, 'engagements', aliceEngagement)
  const msgRef = doc(collection(engRef, 'messages'))
  const batch = writeBatch(db)
  batch.set(msgRef, outbound(contactId, opts.message))
  batch.update(
    engRef,
    new FieldPath('emailCounts', opts.bumpContactId ?? contactId),
    increment(opts.by ?? 1),
    'lastMessageId',
    msgRef.id
  )
  return batch.commit()
}

async function countFor(contactId: string) {
  let value = 0
  await env.withSecurityRulesDisabled(async (ctx) => {
    const snap = await getDoc(
      doc(ctx.firestore() as unknown as Firestore, 'engagements', aliceEngagement)
    )
    value = (snap.data()?.emailCounts?.[contactId] as number | undefined) ?? 0
  })
  return value
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-rules-test',
    firestore: {
      rules: readFileSync(resolve(__dirname, '../firestore.rules'), 'utf8'),
    },
  })
})

afterAll(async () => {
  await env.cleanup()
})

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore
    await setDoc(doc(db, 'scenarios', SCENARIO), {
      title: 'Test',
      companyName: 'Acme',
      brief: 'b',
      _schemaVersion: 1,
    })
    for (const id of ['c1', 'c2']) {
      await setDoc(doc(db, 'scenarios', SCENARIO, 'contacts', id), {
        name: id,
        role: 'r',
        bio: 'b',
        order: 1,
        _schemaVersion: 1,
      })
    }
    await setDoc(doc(db, 'scenarios', SCENARIO, 'contactPersonas', 'c1'), {
      persona: 'secret',
      _schemaVersion: 1,
    })
  })
})

describe('scenarios and contacts', () => {
  it('lets signed-in users read scenarios and contacts', async () => {
    const db = dbFor(ALICE)
    await assertSucceeds(getDoc(doc(db, 'scenarios', SCENARIO)))
    await assertSucceeds(getDocs(collection(db, 'scenarios', SCENARIO, 'contacts')))
  })

  it('blocks signed-out reads and all client writes', async () => {
    const anon = env.unauthenticatedContext().firestore() as unknown as Firestore
    await assertFails(getDoc(doc(anon, 'scenarios', SCENARIO)))
    await assertFails(setDoc(doc(dbFor(ALICE), 'scenarios', 'new'), { title: 'x' }))
  })

  it('keeps contact personas server-only', async () => {
    await assertFails(getDoc(doc(dbFor(ALICE), 'scenarios', SCENARIO, 'contactPersonas', 'c1')))
  })
})

describe('engagements', () => {
  it('lets a learner create their own empty engagement', async () => {
    await assertSucceeds(
      setDoc(doc(dbFor(ALICE), 'engagements', aliceEngagement), newEngagement(ALICE))
    )
  })

  it('rejects a wrong ID, another user, a pre-filled count or an unknown scenario', async () => {
    const db = dbFor(ALICE)
    await assertFails(setDoc(doc(db, 'engagements', 'alice_other'), newEngagement(ALICE)))
    await assertFails(setDoc(doc(db, 'engagements', `${BOB}_${SCENARIO}`), newEngagement(BOB)))
    await assertFails(
      setDoc(
        doc(db, 'engagements', aliceEngagement),
        newEngagement(ALICE, { emailCounts: { c1: 0 } })
      )
    )
    await assertFails(
      setDoc(doc(db, 'engagements', 'alice_nope'), newEngagement(ALICE, { scenarioId: 'nope' }))
    )
  })

  it('lets a learner check for their own engagement before it exists', async () => {
    await assertSucceeds(getDoc(doc(dbFor(ALICE), 'engagements', aliceEngagement)))
  })
})

describe('sending emails', () => {
  beforeEach(async () => {
    await setDoc(doc(dbFor(ALICE), 'engagements', aliceEngagement), newEngagement(ALICE))
  })

  it('AC2: saves the email and counts it in one batch', async () => {
    await assertSucceeds(sendBatch(dbFor(ALICE), 'c1'))
    expect(await countFor('c1')).toBe(1)
  })

  it('AC3: allows 3 emails per contact and denies the 4th', async () => {
    const db = dbFor(ALICE)
    for (let i = 0; i < 3; i++) await assertSucceeds(sendBatch(db, 'c1'))
    await assertFails(sendBatch(db, 'c1'))
    expect(await countFor('c1')).toBe(3)
    // other contacts are unaffected
    await assertSucceeds(sendBatch(db, 'c2'))
  })

  it('AC3: denies jumping the count by more than one', async () => {
    await assertFails(sendBatch(dbFor(ALICE), 'c1', { by: 2 }))
  })

  it('denies a message without a counter bump', async () => {
    const db = dbFor(ALICE)
    const ref = doc(collection(db, 'engagements', aliceEngagement, 'messages'))
    await assertFails(setDoc(ref, outbound('c1')))
  })

  it('denies a counter bump without a message', async () => {
    const db = dbFor(ALICE)
    await assertFails(
      updateDoc(
        doc(db, 'engagements', aliceEngagement),
        new FieldPath('emailCounts', 'c1'),
        increment(1),
        'lastMessageId',
        'ghost'
      )
    )
  })

  it('denies counting a different contact than the one emailed', async () => {
    await assertFails(sendBatch(dbFor(ALICE), 'c1', { bumpContactId: 'c2' }))
  })

  it('denies emailing a contact that is not in the scenario', async () => {
    await assertFails(sendBatch(dbFor(ALICE), 'nobody'))
  })

  it('AC5: denies empty, blank or over-long fields', async () => {
    const db = dbFor(ALICE)
    await assertFails(sendBatch(db, 'c1', { message: { subject: '' } }))
    await assertFails(sendBatch(db, 'c1', { message: { body: '   ' } }))
    await assertFails(sendBatch(db, 'c1', { message: { subject: 'x'.repeat(121) } }))
    await assertFails(sendBatch(db, 'c1', { message: { body: 'x'.repeat(2001) } }))
    await assertSucceeds(sendBatch(db, 'c1', { message: { body: 'x'.repeat(2000) } }))
  })

  it('denies clients writing AI replies or extra fields', async () => {
    const db = dbFor(ALICE)
    await assertFails(sendBatch(db, 'c1', { message: { direction: 'inbound' } }))
    await assertFails(sendBatch(db, 'c1', { message: { score: 10 } }))
  })

  it('keeps sent emails immutable', async () => {
    const db = dbFor(ALICE)
    await sendBatch(db, 'c1')
    const snap = await getDocs(collection(db, 'engagements', aliceEngagement, 'messages'))
    const ref = snap.docs[0]!.ref
    await assertFails(updateDoc(ref, { body: 'edited' }))
    await assertFails(deleteDoc(ref))
  })

  it("AC8: denies another learner reading or writing Alice's engagement", async () => {
    await sendBatch(dbFor(ALICE), 'c1')
    const bob = dbFor(BOB)
    await assertFails(getDoc(doc(bob, 'engagements', aliceEngagement)))
    await assertFails(getDocs(collection(bob, 'engagements', aliceEngagement, 'messages')))
    await assertFails(sendBatch(bob, 'c2'))
  })
})
