import path from 'node:path'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert'

const root = '/Users/leifermendez/Projects/builderbot'
const pkgs = [
  { name: '@builderbot/bot (cjs via esm)', file: 'packages/bot/dist/index.cjs', required: ['createBot', 'createFlow'] },
  { name: '@builderbot/provider-baileys (mjs)', file: 'packages/provider-baileys/dist/index.mjs' },
  { name: '@builderbot/provider-baileys (cjs via esm)', file: 'packages/provider-baileys/dist/index.cjs' },
  { name: '@builderbot/cli', file: 'packages/cli/dist/index.cjs' },
  { name: '@builderbot/contexts-dialogflow', file: 'packages/contexts-dialogflow/dist/index.cjs' },
  { name: '@builderbot/contexts-dialogflow-cx', file: 'packages/contexts-dialogflow-cx/dist/index.cjs' },
  { name: '@builderbot/database-json', file: 'packages/database-json/dist/index.cjs' },
  { name: '@builderbot/database-mongo', file: 'packages/database-mongo/dist/index.cjs' },
  { name: '@builderbot/database-mysql', file: 'packages/database-mysql/dist/index.cjs' },
  { name: '@builderbot/database-postgres', file: 'packages/database-postgres/dist/index.cjs' },
  { name: 'eslint-plugin-builderbot', file: 'packages/eslint-plugin-builderbot/dist/index.cjs' },
  { name: '@builderbot/provider-evolution-api', file: 'packages/provider-evolution-api/dist/index.cjs' },
  { name: '@builderbot/provider-meta', file: 'packages/provider-meta/dist/index.cjs' },
  { name: '@builderbot/provider-telegram', file: 'packages/provider-telegram/dist/index.cjs' },
  { name: '@builderbot/provider-twilio', file: 'packages/provider-twilio/dist/index.cjs' },
  { name: '@builderbot/provider-venom', file: 'packages/provider-venom/dist/index.cjs' },
  { name: '@builderbot/provider-web-whatsapp', file: 'packages/provider-web-whatsapp/dist/index.cjs' },
  { name: '@builderbot/provider-wppconnect', file: 'packages/provider-wppconnect/dist/index.cjs' },
]

let failures = 0
for (const p of pkgs) {
  const filePath = path.join(root, p.file)
  const fileUrl = pathToFileURL(filePath).href
  try {
    if (!fs.existsSync(filePath)) throw new Error('file not found: ' + filePath)
    const ns = await import(fileUrl)
    const mod = ns.default && Object.keys(ns).length <= 1 ? ns.default : ns
    if (p.required) for (const k of p.required) assert.ok(mod[k] || ns[k], `${p.name} missing export ${k} in ESM`)
    console.log(`OK ESM ${p.name}`)
  } catch (e) {
    failures++
    console.error(`FAIL ESM ${p.name}: ${e && e.message ? e.message : e}`)
  }
}
if (failures) process.exit(1)


