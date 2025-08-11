const path = require('node:path')
const fs = require('node:fs')
const assert = require('node:assert')

const root = '/Users/leifermendez/Projects/builderbot'
const pkgs = [
  { name: '@builderbot/bot', file: 'packages/bot/dist/index.cjs', required: ['createBot', 'createFlow'] },
  { name: '@builderbot/cli', file: 'packages/cli/dist/index.cjs' },
  { name: '@builderbot/contexts-dialogflow', file: 'packages/contexts-dialogflow/dist/index.cjs' },
  { name: '@builderbot/contexts-dialogflow-cx', file: 'packages/contexts-dialogflow-cx/dist/index.cjs' },
  { name: '@builderbot/database-json', file: 'packages/database-json/dist/index.cjs' },
  { name: '@builderbot/database-mongo', file: 'packages/database-mongo/dist/index.cjs' },
  { name: '@builderbot/database-mysql', file: 'packages/database-mysql/dist/index.cjs' },
  { name: '@builderbot/database-postgres', file: 'packages/database-postgres/dist/index.cjs' },
  { name: 'eslint-plugin-builderbot', file: 'packages/eslint-plugin-builderbot/dist/index.cjs' },
  { name: '@builderbot/provider-baileys', file: 'packages/provider-baileys/dist/index.cjs' },
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
  const modPath = path.join(root, p.file)
  try {
    if (!fs.existsSync(modPath)) throw new Error('file not found: ' + modPath)
    const mod = require(modPath)
    if (p.required) for (const k of p.required) assert.ok(mod[k], `${p.name} missing export ${k}`)
    console.log(`OK CJS ${p.name}`)
  } catch (e) {
    failures++
    console.error(`FAIL CJS ${p.name}: ${e && e.message ? e.message : e}`)
  }
}
if (failures) process.exit(1)


