/* Regression specs for the animations: they must play when the site is OPENED (direct load / F5), not only after the
   first in-app navigation, and they must be switched off by "reduce motion". Same three engines as layout.spec.ts.
   Unlike the layout specs these open the page with motion 'full'. */
import { expect, test } from '@playwright/test'
import { open } from './support/app.js'

/** The angle (degrees) of the CSS `rotate` property of each element, read in the same frame. */
const angles = (selector: string) => (page: import('@playwright/test').Page) =>
  page.evaluate((sel) => Array.from(document.querySelectorAll(sel)).map((el) => parseFloat(getComputedStyle(el).rotate) || 0), selector)

test.describe('art-form wheel (/learn)', () => {
  test('turns on a direct load, and the pictures turn back so they stay upright', async ({ page }) => {
    await open(page, '/learn', { motion: 'full' })
    // under load (3 engines at once) the lazy page can still be arriving when settle() gives up waiting
    await page.locator('.wheel-turn').waitFor({ state: 'attached', timeout: 20_000 })
    const turn = angles('.wheel-turn')
    const hold = angles('.wheel-hold')
    const [ring1] = await turn(page)
    await page.waitForTimeout(1500)
    const [ring2] = await turn(page)
    expect(ring2, 'the ring moved in 1.5 s').not.toBeCloseTo(ring1, 3)
    // read together, in one frame: ring + picture = a full turn (0 modulo 360)
    const pair = await page.evaluate(() => {
      const r = parseFloat(getComputedStyle(document.querySelector('.wheel-turn')!).rotate) || 0
      const h = parseFloat(getComputedStyle(document.querySelector('.wheel-hold')!).rotate) || 0
      return (((r + h) % 360) + 360) % 360
    })
    expect(Math.min(pair, 360 - pair), 'ring angle + picture angle').toBeLessThan(0.5)
    expect((await hold(page)).length, 'pictures on the ring').toBeGreaterThan(3)
  })

  test('stays still when motion is reduced', async ({ page }) => {
    await open(page, '/learn', { motion: 'reduce' })
    await expect(page.locator('.wheel-turn')).toHaveCount(0)
    await expect(page.locator('.wheel-hold')).toHaveCount(0)
  })
})

test.describe('tooltip', () => {
  test('fades out instead of vanishing, and then leaves the page', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await open(page, '/free-draw', { motion: 'full' })
    await page.locator('[data-tour="tools"]:visible button').first().hover()
    const tip = page.getByRole('tooltip')
    await expect(tip).toBeVisible()
    // Record what the bubble looks like while it leaves, inside the page: asking from the test after the mouse has
    // moved would race the 170 ms fade-out on a busy machine.
    await page.evaluate(() => {
      const seen: { cls: string; hidden: string | null }[] = []
      ;(window as unknown as { __tipSeen: typeof seen }).__tipSeen = seen
      new MutationObserver(() => {
        const el = document.querySelector('[role="tooltip"]')
        if (el && el.className.includes('tooltip-out')) seen.push({ cls: el.className, hidden: el.getAttribute('aria-hidden') })
      }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'aria-hidden'] })
    })
    await page.mouse.move(700, 450)
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __tipSeen: unknown[] }).__tipSeen.length), {
        message: 'the bubble was seen fading out',
      })
      .toBeGreaterThan(0)
    const leaving = await page.evaluate(() => (window as unknown as { __tipSeen: { cls: string; hidden: string | null }[] }).__tipSeen[0])
    expect(leaving.cls).toContain('tooltip-out')
    expect(leaving.hidden).toBe('true')
    await expect(page.locator('[role="tooltip"]')).toHaveCount(0, { timeout: 2000 })
  })
})

test.describe('fonts', () => {
  test('no font stack of the app names Georgia (it has no glyph for ề on Windows: the accent was drawn apart)', async ({ page }) => {
    await open(page, '/', { motion: 'full' })
    const stacks = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement)
      const h1 = document.querySelector('h1')
      return {
        display: root.getPropertyValue('--font-display'),
        sans: root.getPropertyValue('--font-sans'),
        h1: h1 ? getComputedStyle(h1).fontFamily : '',
        body: getComputedStyle(document.body).fontFamily,
      }
    })
    for (const [name, stack] of Object.entries(stacks)) expect(stack, name).not.toMatch(/georgia/i)
    expect(stacks.display).toMatch(/fraunces/i)
  })
})

test.describe('fonts (production build only)', () => {
  test('the text fonts are asked for by <link rel=preload>, before the style sheet and scripts get to name them', async ({
    page,
    browserName,
  }) => {
    await open(page, '/', { motion: 'full' })
    const preloads = await page.locator('link[rel="preload"][as="font"]').count()
    test.skip(preloads === 0, 'the dev server does not add the preload links (vite.config.ts: preloadFonts is build-only)')
    const initiators = await page.evaluate(() =>
      performance
        .getEntriesByType('resource')
        .filter((e) => /(fraunces-latin-opsz|inter-latin-wght)/.test(e.name))
        .map((e) => (e as PerformanceResourceTiming).initiatorType),
    )
    expect(preloads).toBeGreaterThanOrEqual(3)
    expect(initiators.length).toBeGreaterThanOrEqual(3)
    // Chromium reports a preloaded file as started by the <link>; without the preload it would say 'css'
    if (browserName === 'chromium') expect(initiators.every((i) => i === 'link')).toBe(true)
  })
})
