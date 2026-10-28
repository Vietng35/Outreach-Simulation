#!/usr/bin/env node
/**
 * Seeds the demo client scenario for the contact-outreach feature.
 *
 * Writes with the Admin SDK (bypasses security rules), using the service
 * account in the root .env. Safe to re-run — it overwrites the same documents
 * and never touches learners' engagements.
 *
 * Run via: pnpm run seed:outreach
 */
'use strict'

const fs = require('fs')
const path = require('path')
// firebase-admin is a dependency of the frontend package, so resolve it from there
const frontendDir = path.resolve(__dirname, '..', 'frontend')
const fromFrontend = (id) => require(require.resolve(id, { paths: [frontendDir] }))
const { initializeApp, cert } = fromFrontend('firebase-admin/app')
const { getFirestore } = fromFrontend('firebase-admin/firestore')

function readEnv() {
  const envPath = path.resolve(__dirname, '..', '.env')
  if (!fs.existsSync(envPath)) throw new Error('No .env at the repo root — see docs/ENV-VARS.md')
  const vars = {}
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#') || !t.includes('=')) continue
    const i = t.indexOf('=')
    vars[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')
  }
  return vars
}

const SCENARIO_ID = 'harbourline-logistics'

const scenario = {
  title: 'Delivery performance discovery',
  companyName: 'Harbourline Logistics',
  brief:
    'Harbourline is a mid-sized Melbourne freight company. On-time deliveries have fallen from ' +
    '94% to 81% in a year and leadership is curious whether AI-assisted route planning could help. ' +
    'Your goal: get the right person to agree to a discovery meeting.',
  _schemaVersion: 1,
}

// Public profile (readable by learners) + private persona (server-only, drives the AI).
const contacts = [
  {
    id: 'priya-raman',
    public: {
      name: 'Priya Raman',
      role: 'Chief Operating Officer',
      bio: 'Oversees depots, fleet and the delivery network across Victoria.',
      order: 1,
    },
    persona:
      'You are the decision-maker: you own the operations budget and would sponsor any project. ' +
      'You are very busy and reply briefly. Generic sales emails get a polite brush-off. If the ' +
      'consultant shows they understand the drop in on-time deliveries and proposes a specific, ' +
      'short next step, agree to a 30-minute discovery meeting and suggest two times next week.',
  },
  {
    id: 'marcus-chen',
    public: {
      name: 'Marcus Chen',
      role: 'IT Manager',
      bio: 'Looks after the routing software, telematics and internal systems.',
      order: 2,
    },
    persona:
      'You are friendly and enthusiastic about technology and happy to describe the current ' +
      'routing system and its data problems in detail. You do not control budget and cannot ' +
      'approve a project or a meeting with leadership; if asked, say decisions like that sit ' +
      'with the COO, Priya Raman.',
  },
  {
    id: 'ellie-novak',
    public: {
      name: 'Ellie Novak',
      role: 'Executive Assistant to the CEO',
      bio: 'Manages the CEO’s calendar and correspondence.',
      order: 3,
    },
    persona:
      'You are a polite, protective gatekeeper. You cannot commit anyone to anything. You offer ' +
      'to pass a short summary to the leadership team, and you will not share colleagues’ ' +
      'direct contact details. Keep replies short and courteous.',
  },
]

async function main() {
  const env = readEnv()
  const key = env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64
  if (!key) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY_BASE64 is empty in .env')

  initializeApp({
    credential: cert(JSON.parse(Buffer.from(key, 'base64').toString('utf8'))),
    projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  })
  const db = getFirestore()
  const scenarioRef = db.collection('scenarios').doc(SCENARIO_ID)

  const batch = db.batch()
  batch.set(scenarioRef, scenario)
  for (const c of contacts) {
    batch.set(scenarioRef.collection('contacts').doc(c.id), { ...c.public, _schemaVersion: 1 })
    batch.set(scenarioRef.collection('contactPersonas').doc(c.id), {
      persona: c.persona,
      _schemaVersion: 1,
    })
  }
  await batch.commit()
  console.log(`Seeded scenarios/${SCENARIO_ID} with ${contacts.length} contacts.`)
}

main().catch((err) => {
  console.error(`\x1b[31m${err.message}\x1b[0m`)
  process.exit(1)
})
