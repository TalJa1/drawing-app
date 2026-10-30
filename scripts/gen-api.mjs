/* Regenerates src/api/schema.d.ts (the back-end's types) from its OpenAPI document.
   The back-end serves it at /openapi.json while it runs in development (production closes it);
   point OPENAPI_SOURCE at another URL or a saved file to use that instead.

   openapi-typescript is run through npx rather than installed: it asks for TypeScript 5 and this
   project uses 6, so npm refuses it as a dependency. npx gives it its own copy. */
import { spawnSync } from 'node:child_process'

const SOURCE = process.env.OPENAPI_SOURCE || 'http://127.0.0.1:8000/openapi.json'
const OUT = 'src/api/schema.d.ts'
const TOOL = 'openapi-typescript@7.13.0'

function run(args) {
  const r = spawnSync('npx', ['--yes', ...args], { stdio: 'inherit', shell: true })
  if (r.status !== 0) {
    console.error(`\nFailed: npx ${args.join(' ')}`)
    process.exit(r.status ?? 1)
  }
}

console.log(`Reading ${SOURCE}`)
run([TOOL, SOURCE, '-o', OUT])
run(['prettier', '--write', OUT]) // generated code is 4-space with semicolons; keep the project's style
