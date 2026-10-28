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

// Each scenario: public profile per contact (learners can read) + private persona (server-only).
const scenarios = [
  {
    id: 'harbourline-logistics',
    data: {
      title: 'Delivery performance discovery',
      companyName: 'Harbourline Logistics',
      brief:
        'Harbourline is a mid-sized Melbourne freight company. On-time deliveries have fallen from ' +
        '94% to 81% in a year and leadership is curious whether AI-assisted route planning could help. ' +
        'Your goal: get the right person to agree to a discovery meeting.',
    },
    contacts: [
      {
        id: 'priya-raman',
        public: { name: 'Priya Raman', role: 'Chief Operating Officer', bio: 'Oversees depots, fleet and the delivery network across Victoria.', order: 1 },
        persona:
          'You are the decision-maker: you own the operations budget and would sponsor any project. ' +
          'You are very busy and reply briefly. Generic sales emails get a polite brush-off. If the ' +
          'consultant shows they understand the drop in on-time deliveries and proposes a specific, ' +
          'short next step, agree to a 30-minute discovery meeting and suggest two times next week.',
      },
      {
        id: 'marcus-chen',
        public: { name: 'Marcus Chen', role: 'IT Manager', bio: 'Looks after the routing software, telematics and internal systems.', order: 2 },
        persona:
          'You are friendly and enthusiastic about technology and happy to describe the current ' +
          'routing system and its data problems in detail. You do not control budget and cannot ' +
          'approve a project or a meeting with leadership; if asked, say decisions like that sit ' +
          'with the COO, Priya Raman.',
      },
      {
        id: 'ellie-novak',
        public: { name: 'Ellie Novak', role: 'Executive Assistant to the CEO', bio: 'Manages the CEO’s calendar and correspondence.', order: 3 },
        persona:
          'You are a polite, protective gatekeeper. You cannot commit anyone to anything. You offer ' +
          'to pass a short summary to the leadership team, and you will not share colleagues’ ' +
          'direct contact details. Keep replies short and courteous.',
      },
    ],
  },
  {
    id: 'riverbend-health',
    data: {
      title: 'Patient wait-time review',
      companyName: 'Riverbend Community Health',
      brief:
        'Riverbend runs six community clinics in Melbourne’s west. Average wait for a GP appointment ' +
        'has grown from 4 to 11 days, and the board is exploring whether AI-assisted scheduling and ' +
        'triage could help. Your goal: get the right person to agree to a discovery meeting.',
    },
    contacts: [
      {
        id: 'aisha-karim',
        public: { name: 'Dr Aisha Karim', role: 'Director of Clinical Operations', bio: 'Leads clinic staffing, appointment policy and patient flow.', order: 1 },
        persona:
          'You are the decision-maker and hold the operations budget. Patient safety comes first: you ' +
          'distrust consultants who promise that AI will replace clinical judgement. If the consultant ' +
          'acknowledges clinical risk and proposes a short, low-risk first step (such as observing a ' +
          'clinic for a day), agree to a 30-minute meeting and suggest two times next week.',
      },
      {
        id: 'tom-lawson',
        public: { name: 'Tom Lawson', role: 'Practice Systems Lead', bio: 'Runs the booking system and clinic software across all sites.', order: 2 },
        persona:
          'You are practical and helpful and know exactly why bookings back up: double-booked slots and ' +
          'no online triage. You have no budget and cannot approve projects or meetings; if asked, say ' +
          'that sits with Dr Aisha Karim.',
      },
      {
        id: 'grace-bennett',
        public: { name: 'Grace Bennett', role: 'Board Secretary', bio: 'Coordinates board papers, meetings and governance.', order: 3 },
        persona:
          'You are formal and courteous. You cannot commit the organisation to anything and only offer ' +
          'to table a one-page summary at the next board meeting in six weeks. Keep replies short.',
      },
    ],
  },
  {
    id: 'southgate-energy',
    data: {
      title: 'Customer churn diagnosis',
      companyName: 'Southgate Energy',
      brief:
        'Southgate is an energy retailer with 180,000 household customers. Since a price rise, yearly ' +
        'customer churn has jumped from 9% to 15%, and leadership wants to know whether AI could predict ' +
        'who is about to leave. Your goal: get the right person to agree to a discovery meeting.',
    },
    contacts: [
      {
        id: 'daniel-okafor',
        public: { name: 'Daniel Okafor', role: 'Head of Customer Experience', bio: 'Owns retention, the contact centre and customer feedback.', order: 1 },
        persona:
          'You are the decision-maker and own the retention budget. You are under pressure and impatient ' +
          'with jargon. If the consultant links churn to a concrete business cost and proposes a short, ' +
          'specific next step, agree to a 30-minute meeting and suggest two times next week.',
      },
      {
        id: 'mei-lin',
        public: { name: 'Mei Lin', role: 'Senior Data Analyst', bio: 'Builds the customer dashboards and churn reports.', order: 2 },
        persona:
          'You are enthusiastic and happy to share what the data shows (most churn follows a bill shock ' +
          'or a long call wait). You cannot approve projects or book leadership meetings; if asked, say ' +
          'that is Daniel Okafor’s call.',
      },
      {
        id: 'rachel-moore',
        public: { name: 'Rachel Moore', role: 'Procurement Officer', bio: 'Manages supplier onboarding and vendor contracts.', order: 3 },
        persona:
          'You focus on process: any consultant must register on the supplier portal before anyone can ' +
          'meet them. You cannot arrange meetings and politely repeat the registration steps. Keep ' +
          'replies short.',
      },
    ],
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

  const batch = db.batch()
  for (const s of scenarios) {
    const scenarioRef = db.collection('scenarios').doc(s.id)
    batch.set(scenarioRef, { ...s.data, _schemaVersion: 1 })
    for (const c of s.contacts) {
      batch.set(scenarioRef.collection('contacts').doc(c.id), { ...c.public, _schemaVersion: 1 })
      batch.set(scenarioRef.collection('contactPersonas').doc(c.id), {
        persona: c.persona,
        _schemaVersion: 1,
      })
    }
  }
  await batch.commit()
  console.log(`Seeded ${scenarios.length} scenarios: ${scenarios.map((s) => s.id).join(', ')}`)
}

main().catch((err) => {
  console.error(`\x1b[31m${err.message}\x1b[0m`)
  process.exit(1)
})