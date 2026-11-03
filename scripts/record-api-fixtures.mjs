/* Records the back-end's real responses into e2e/fixtures/api/, which the layout specs replay (e2e/support/app.ts).

   Why: the layout and accessibility specs must run in CI with no back-end, but against data shaped exactly like the
   real thing. Recording from a running back-end keeps the fixtures honest; re-run this when an endpoint changes
   shape (`tsc` already fails on drift of the types, but the fixtures are plain JSON and would not).

   Usage (back-end running and freshly seeded):  npm run e2e:fixtures
   API address: E2E_RECORD_API (default http://127.0.0.1:8000, the origin only, without /api/v1).
   It registers one throw-away account on that back-end to record the signed-in endpoints. */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ORIGIN = (process.env.E2E_RECORD_API ?? 'http://127.0.0.1:8000').replace(/\/$/, '')
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'e2e', 'fixtures', 'api')

/** [method + path the app calls, file name]. Order matters only for the manifest's readability. */
const PUBLIC = [
  ['/templates', 'templates.json'],
  ['/templates/fox', 'template-fox.json'],
  ['/lessons', 'lessons.json'],
  ['/art-forms', 'art-forms.json'],
  ['/glossary', 'glossary.json'],
  ['/template-popularity', 'template-popularity.json'],
  ['/challenges/daily-template', 'daily-template.json'],
]
const SIGNED_IN = [
  ['/me', 'me.json'],
  ['/me/learning', 'me-learning.json'],
  ['/me/progress', 'me-progress.json'],
  ['/artworks', 'artworks.json'],
  ['/challenges', 'challenges.json'],
  ['/achievements', 'achievements.json'],
  // the page asks for ?scope=weekly or ?scope=all; the stub matches the path only, so one recording serves both
  ['/leaderboard?scope=weekly', 'leaderboard.json'],
]

async function call(method, path, { token, body } = {}) {
  const res = await fetch(`${ORIGIN}/api/v1${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 200)}`)
  return text
}

await mkdir(OUT, { recursive: true })
const manifest = {}
const save = async (path, file, text) => {
  // pretty-printed so a change to a fixture shows up as a readable diff
  await writeFile(join(OUT, file), JSON.stringify(JSON.parse(text), null, 2) + '\n')
  manifest[`GET ${path.split('?')[0]}`] = file
  console.log(`  GET ${path.padEnd(30)} -> ${file}`)
}

console.log(`Recording from ${ORIGIN}`)
for (const [path, file] of PUBLIC) await save(path, file, await call('GET', path))

const email = `fixtures-${Date.now()}@example.com`
const auth = JSON.parse(await call('POST', '/auth/register', { body: { displayName: 'Fixture Artist', email, password: 'long-enough-1' } }))
for (const [path, file] of SIGNED_IN) await save(path, file, await call('GET', path, { token: auth.token }))
// the signed-in user, for the spec to put in the session store (the token is a stand-in: the stub does not check it)
await writeFile(join(OUT, 'session-user.json'), JSON.stringify(auth.user, null, 2) + '\n')
await writeFile(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
console.log(`Done: ${Object.keys(manifest).length} responses + session-user.json in e2e/fixtures/api/`)
