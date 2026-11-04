/* Audit: the page's scroll may be locked in ONE place only, `useScrollLock` in hooks.ts, which counts the locks so
   that dialogs closing in any order give the page back. Anything else that writes the scroll behaviour of <body> or
   <html> (a style, a class, an inert / aria-hidden on the app root) can leave the page stuck after a dialog closes.
   NOTE: the list of files is read when the test file is transformed, and vitest keeps that in node_modules/.vitest-cache:
   on a machine that has run the tests before, delete that folder to make the test see a file that was added since
   (a cold run, as in CI, always does). */
const sources = import.meta.glob<string>('/src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true })
const ALLOWED = new Set(['/src/lib/hooks.ts'])

const production = Object.entries(sources).filter(([path]) => !/\.test\.(ts|tsx)$/.test(path) && !path.startsWith('/src/test/'))

const PATTERNS: [RegExp, string][] = [
  [
    /(document\.(body|documentElement)|\bbody|\bhtml)\.style\.(overflow|position|touchAction|overscroll)/,
    'writes the scroll style of body/html',
  ],
  [/style\.setProperty\(\s*['"](overflow|position|touch-action|overscroll)/, 'sets overflow/position through setProperty'],
  [/document\.(body|documentElement)\.classList\.(add|toggle)/, 'adds a class to body/html (a "no-scroll" class)'],
  [/\.inert\s*=|setAttribute\(\s*['"]inert/, 'sets inert (it makes the rest of the page unusable if it is not undone)'],
  [/(#root|getElementById\(\s*['"]root['"]\s*\))[\s\S]{0,80}(inert|aria-hidden)/, 'sets inert / aria-hidden on the app root'],
]

describe('scroll lock audit', () => {
  it('looks at the source files (guards against the glob matching nothing)', () => {
    expect(production.length).toBeGreaterThan(100)
    expect(sources['/src/lib/hooks.ts']).toContain('useScrollLock')
  })

  it('only useScrollLock touches the scroll of the page', () => {
    const found: string[] = []
    for (const [path, text] of production) {
      if (ALLOWED.has(path)) continue
      for (const [re, why] of PATTERNS) if (re.test(text)) found.push(`${path}: ${why}`)
    }
    expect(found, 'put the lock in useScrollLock (src/lib/hooks.ts) instead').toEqual([])
  })

  it('both dialog components (Modal and Sheet) take their lock from useScrollLock', () => {
    const modal = sources['/src/components/Modal.tsx']
    expect((modal.match(/useScrollLock\(open\)/g) ?? []).length).toBe(2)
  })
})
