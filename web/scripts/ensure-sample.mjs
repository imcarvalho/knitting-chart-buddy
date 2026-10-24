// The sample chart is extracted from the pattern PDF, which is not in the repository.
// Generate it from fixtures/ when it is missing, or explain what is needed.
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const sample = fileURLToPath(new URL('../public/samples/back-yoke.json', import.meta.url))
const pdf = fileURLToPath(new URL('../../fixtures/Shanon_Sweater_tamanho3-back.pdf', import.meta.url))

if (existsSync(sample)) process.exit(0)
if (!existsSync(pdf)) {
  console.error(
    `Missing ${pdf}.\nPut your copy of the Shanon Sweater back yoke chart page there, then run \`pnpm sample\`.`,
  )
  process.exit(1)
}
console.log('Generating public/samples/back-yoke.json from the fixture PDF...')
const res = spawnSync('pnpm', ['sample'], { stdio: 'inherit' })
process.exit(res.status ?? 1)
