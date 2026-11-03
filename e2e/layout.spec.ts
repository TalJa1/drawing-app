/* Regression specs for the layout and accessibility defects of docs/UIUX_DEFECT_LOG (UX-01, UX-06, UX-19 and the
   routes they were found on). They run in Chromium, WebKit and Firefox (see playwright.config.ts): UX-01 only
   showed in WebKit, and a Chromium-only run hides it.

   - overflow: no page scrolls sideways at 375 / 768 / 1440 (UX-06: tooltips and grids pushed /learn, /learn/color-lab
     and /collection wider than a phone).
   - axe: no WCAG 2.0 / 2.1 A + AA violation on any route (UX-19: names that did not contain the visible text).
   - hero: the headline is two lines at most and the main button is on the first screen, in both languages (UX-01). */
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { horizontalOverflow, open } from './support/app.js'

const PUBLIC_ROUTES = [
  '/',
  '/practice',
  '/practice/fox',
  '/free-draw',
  '/learn',
  '/learn/art-forms/drawing',
  '/learn/movements/renaissance',
  '/learn/artists/leonardo-da-vinci',
  '/learn/lessons/rule-of-thirds',
  '/learn/color-lab',
  '/learn/glossary',
  '/learn/flashcards',
  '/learn/spot-the-style',
  '/chat',
  '/profile',
  '/login',
  '/register',
  '/this-page-does-not-exist',
]
const SIGNED_IN_ROUTES = ['/collection', '/achievements', '/profile', '/practice']

const PHONE = { width: 375, height: 812 }
const TABLET = { width: 768, height: 1024 }
const DESKTOP = { width: 1440, height: 900 }

test.describe('no page scrolls sideways', () => {
  for (const vp of [PHONE, TABLET, DESKTOP]) {
    test.describe(`${vp.width}px`, () => {
      test.use({ viewport: vp })
      for (const path of PUBLIC_ROUTES) {
        test(`visitor ${path}`, async ({ page }) => {
          await open(page, path, { language: 'vi' }) // Vietnamese is the longer text: the one that overflows first
          const o = await horizontalOverflow(page)
          expect(o.scroll, `scrollWidth ${o.scroll} > ${o.client}; sticking out: ${o.sticking.join(' | ')}`).toBeLessThanOrEqual(o.client)
        })
      }
      for (const path of SIGNED_IN_ROUTES) {
        test(`signed in ${path}`, async ({ page }) => {
          await open(page, path, { language: 'vi', signedIn: true })
          expect(new URL(page.url()).pathname, 'a signed-in visitor must not be sent away').toBe(path)
          const o = await horizontalOverflow(page)
          expect(o.scroll, `scrollWidth ${o.scroll} > ${o.client}; sticking out: ${o.sticking.join(' | ')}`).toBeLessThanOrEqual(o.client)
        })
      }
    })
  }

  test.describe('375px, English', () => {
    test.use({ viewport: PHONE })
    for (const path of ['/', '/practice', '/learn', '/learn/color-lab']) {
      test(path, async ({ page }) => {
        await open(page, path, { language: 'en' })
        const o = await horizontalOverflow(page)
        expect(o.scroll, `scrollWidth ${o.scroll} > ${o.client}; sticking out: ${o.sticking.join(' | ')}`).toBeLessThanOrEqual(o.client)
      })
    }
  })
})

test.describe('accessibility (axe, WCAG 2.0/2.1 A + AA)', () => {
  const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
  const report = (violations: { id: string; nodes: { html: string }[] }[]) =>
    violations.map((v) => `${v.id} x${v.nodes.length}: ${v.nodes[0]?.html.replace(/\s+/g, ' ').slice(0, 140)}`).join('\n')

  for (const vp of [PHONE, DESKTOP]) {
    test.describe(`${vp.width}px`, () => {
      test.use({ viewport: vp })
      for (const path of PUBLIC_ROUTES) {
        test(`visitor ${path}`, async ({ page }) => {
          await open(page, path, { language: 'vi' })
          const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze()
          expect(violations, report(violations)).toEqual([])
        })
      }
      for (const path of SIGNED_IN_ROUTES) {
        test(`signed in ${path}`, async ({ page }) => {
          await open(page, path, { language: 'vi', signedIn: true })
          const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze()
          expect(violations, report(violations)).toEqual([])
        })
      }
    })
  }

  test('English home page', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await open(page, '/', { language: 'en' })
    const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze()
    expect(violations, report(violations)).toEqual([])
  })
})

test.describe('home hero (UX-01)', () => {
  // The sizes the defect was measured at, including the ones where it was worst (1366x768, 1536x730, 1280x720).
  const SIZES = [
    { width: 1280, height: 720 },
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1536, height: 730 },
    { width: 1920, height: 1080 },
    { width: 375, height: 812 },
  ]
  for (const language of ['vi', 'en'] as const) {
    for (const vp of SIZES) {
      test(`${language} ${vp.width}x${vp.height}`, async ({ page }) => {
        await page.setViewportSize(vp)
        await open(page, '/', { language })
        const h1 = page.getByRole('heading', { level: 1 })
        const lines = await h1.evaluate((el) => {
          const lh = parseFloat(getComputedStyle(el).lineHeight)
          return Math.round(el.getBoundingClientRect().height / lh)
        })
        // A phone is allowed a third line (the column is narrow); a desktop headline is two lines.
        expect(lines, 'headline lines').toBeLessThanOrEqual(vp.width < 640 ? 3 : 2)
        const cta = page.getByRole('link', { name: language === 'vi' ? /bắt đầu vẽ/i : /start drawing/i }).first()
        const box = (await cta.boundingBox())!
        expect(box.y + box.height, 'bottom of the main button against the window').toBeLessThanOrEqual(vp.height)
      })
    }
  }
})
