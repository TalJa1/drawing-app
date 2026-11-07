/* Regression specs for the studio (docs/UIUX_DEFECT_LOG: UX-03 tour, UX-04 tool rail, UX-11 colour row, UX-12 shortcut
   chips). Same three engines as layout.spec.ts. The page is /free-draw: it needs no account and no template. */
import { expect, test, type Locator, type Page } from '@playwright/test'
import { open } from './support/app.js'

const box = async (l: Locator) => (await l.boundingBox())!
const overlapArea = (a: { x: number; y: number; width: number; height: number }, b: typeof a) => {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  return w > 0 && h > 0 ? w * h : 0
}
const visibleDialogs = (page: Page) => page.locator('[role="dialog"][aria-modal="true"]:visible')

test.describe('tool rail on a short window (UX-04)', () => {
  for (const vp of [
    { width: 1280, height: 720 },
    { width: 1366, height: 650 },
    { width: 1440, height: 900 },
  ]) {
    test(`${vp.width}x${vp.height}: inside the window and under the options bar`, async ({ page }) => {
      await page.setViewportSize(vp)
      await open(page, '/free-draw')
      const rail = await box(page.locator('[data-tour="tools"]:visible').first())
      const options = await box(page.locator('[data-tour="options"]:visible').first())
      expect(rail.y, 'top of the rail').toBeGreaterThanOrEqual(0)
      expect(rail.y + rail.height, 'bottom of the rail').toBeLessThanOrEqual(vp.height)
      expect(overlapArea(rail, options), 'rail over the tool-options bar').toBe(0)
    })
  }

  test('on a short window every tool is still reachable and its tooltip is not cut off', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 650 })
    await open(page, '/free-draw')
    const buttons = page.locator('[data-tour="tools"]:visible button')
    expect(await buttons.count()).toBeGreaterThan(10)
    await buttons.last().hover()
    const tip = page.getByRole('tooltip')
    await expect(tip).toBeVisible()
    const t = await box(tip)
    expect(t.x + t.width, 'tooltip right edge').toBeLessThanOrEqual(1366)
    expect(t.y, 'tooltip top edge').toBeGreaterThanOrEqual(0)
  })
})

test.describe('first-visit tour (UX-03)', () => {
  test('Tab stays inside the tour', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await open(page, '/free-draw', { onboardingDone: false })
    const dialog = visibleDialogs(page).first()
    await expect(dialog).toBeVisible()
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab')
      const inside = await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"][aria-modal="true"]'))
      expect(inside, `focus after Tab #${i + 1} is inside the dialog`).toBe(true)
    }
  })

  test('? shows the shortcuts instead of stacking on the tour, and closing it brings the tour back', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await open(page, '/free-draw', { onboardingDone: false })
    await expect(visibleDialogs(page)).toHaveCount(1)
    await page.getByRole('button', { name: /tiếp|next/i }).click() // step 2
    await page.keyboard.press('?')
    await expect(visibleDialogs(page), 'only one dialog at a time').toHaveCount(1)
    await expect(page.getByRole('dialog', { name: /phím tắt|shortcuts/i })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: /phím tắt|shortcuts/i })).toHaveCount(0)
    await expect(visibleDialogs(page), 'the tour is back').toHaveCount(1)
    await expect(page.getByText(/2\s*\/\s*4|2 of 4|2 trên 4|bước 2/i).first(), 'on the step it was left on').toBeVisible()
  })

  test('Escape skips the tour', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await open(page, '/free-draw', { onboardingDone: false })
    await expect(visibleDialogs(page)).toHaveCount(1)
    await page.keyboard.press('Escape')
    await expect(visibleDialogs(page)).toHaveCount(0)
  })

  test('on a phone the card does not cover the tool dock it is describing', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await open(page, '/free-draw', { onboardingDone: false })
    const card = await box(visibleDialogs(page).first().locator('[tabindex="-1"]').first())
    const dock = await box(page.locator('[data-tour="tools"]:visible').first())
    expect(overlapArea(card, dock), 'tour card over the dock').toBe(0)
  })
})

test.describe('studio panels', () => {
  test('colour row: hex and R/G/B fit inside the panel (UX-11)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await open(page, '/free-draw')
    const panel = page.locator('[data-tour="colour"]:visible').first()
    await expect(panel).toBeVisible()
    const p = await box(panel)
    const inputs = panel.locator('input')
    expect(await inputs.count()).toBe(4)
    for (let i = 0; i < 4; i++) {
      const b = await box(inputs.nth(i))
      expect(b.x, `input ${i} left`).toBeGreaterThanOrEqual(p.x - 0.5)
      expect(b.x + b.width, `input ${i} right`).toBeLessThanOrEqual(p.x + p.width + 0.5)
    }
  })

  test('shortcut chips stay inside the dialog (UX-12)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await open(page, '/free-draw')
    await page.keyboard.press('?')
    const dialog = page.getByRole('dialog', { name: /phím tắt|shortcuts/i })
    await expect(dialog).toBeVisible()
    const d = await box(dialog)
    const chips = dialog.locator('kbd')
    expect(await chips.count()).toBeGreaterThan(15)
    for (let i = 0; i < (await chips.count()); i++) {
      const b = await box(chips.nth(i))
      expect(b.x + b.width, `chip ${i} right edge`).toBeLessThanOrEqual(d.x + d.width)
    }
  })

  // The "Redo" row has two long chips; in the two-column list they used to run over the label ("Re..." under them).
  for (const language of ['en', 'vi'] as const) {
    for (const width of [360, 640, 768, 1024, 1440]) {
      test(`shortcut rows: no chip covers its label (${language}, ${width}px)`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 })
        await open(page, '/free-draw', { language })
        await page.keyboard.press('?')
        const dialog = page.locator('[role="dialog"][aria-modal="true"]:visible').first()
        await expect(dialog).toBeVisible()
        const rows = await dialog.locator('dl > div').evaluateAll((els) =>
          els.map((row) => {
            const dt = row.querySelector('dt')!.getBoundingClientRect()
            const dd = row.querySelector('dd')!.getBoundingClientRect()
            const r = row.getBoundingClientRect()
            const text = row.querySelector('dt')!.textContent
            const hit =
              Math.min(dt.right, dd.right) - Math.max(dt.left, dd.left) > 0.5 &&
              Math.min(dt.bottom, dd.bottom) - Math.max(dt.top, dd.top) > 0.5
            return { text, hit, ddRight: dd.right, rowRight: r.right, dtLeft: dt.left, rowLeft: r.left }
          }),
        )
        expect(rows.length).toBeGreaterThan(15)
        for (const r of rows) {
          expect(r.hit, `"${r.text}": the chips sit over the label`).toBe(false)
          expect(r.ddRight, `"${r.text}": chips run past the row`).toBeLessThanOrEqual(r.rowRight + 0.5)
          expect(r.dtLeft, `"${r.text}": label starts before the row`).toBeGreaterThanOrEqual(r.rowLeft - 0.5)
        }
      })
    }
  }
})
