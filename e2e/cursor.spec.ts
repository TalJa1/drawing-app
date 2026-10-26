import { expect, test, type Page } from '@playwright/test'

const settings = (customCursor: boolean) =>
  JSON.stringify({ state: { theme: 'light', language: 'en', onboardingDone: true, customCursor }, version: 2 })

async function freshApp(page: Page, customCursor = true) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.addInitScript((s) => {
    if (sessionStorage.getItem('e2e')) return
    localStorage.clear()
    localStorage.setItem('artspark:settings', s)
    sessionStorage.setItem('e2e', '1')
  }, settings(customCursor))
  return errors
}

type Bounds = { n: number; minX: number; maxX: number; minY: number; maxY: number }

/** Bounding box (CSS px) of the non-transparent pixels of one of the cursor's canvases. */
const bounds = (page: Page, selector: '.art-brush-ink' | '.art-brush-cursor') =>
  page.evaluate((sel): Bounds => {
    const c = document.querySelector<HTMLCanvasElement>(`canvas${sel}`)!
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data
    const k = c.width / window.innerWidth
    let n = 0
    let minX = Infinity
    let minY = Infinity
    let maxX = -1
    let maxY = -1
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x < c.width; x++)
        if (d[(y * c.width + x) * 4 + 3] > 8) {
          n++
          minX = Math.min(minX, x)
          maxX = Math.max(maxX, x)
          minY = Math.min(minY, y)
          maxY = Math.max(maxY, y)
        }
    return { n, minX: minX / k, maxX: maxX / k, minY: minY / k, maxY: maxY / k }
  }, selector)

const inkDisplay = (page: Page) => page.evaluate(() => getComputedStyle(document.querySelector('canvas.art-brush-ink')!).display)

/** A point on plain page content (no link/button/field/canvas), so pressing there is harmless. */
async function plainPoint(page: Page) {
  const p = await page.evaluate(() => {
    const bad =
      'a[href],button,input,select,textarea,label,summary,canvas,[role="button"],[role="tab"],[role="link"],[data-cursor-interactive]'
    for (let y = 120; y < innerHeight - 40; y += 30)
      for (let x = 40; x < innerWidth - 400; x += 40) {
        const el = document.elementFromPoint(x, y)
        const ok = (px: number) => {
          const e = document.elementFromPoint(px, y)
          return !!e && !e.closest(bad)
        }
        if (el && !el.closest(bad) && ok(x + 100) && ok(x + 200)) return { x, y }
      }
    return null
  })
  expect(p, 'a plain, non-interactive area exists on the page').not.toBeNull()
  return p!
}

test.describe('brush cursor', () => {
  test.skip(({ isMobile }) => isMobile, 'fine-pointer behaviour; the mobile project has its own test below')

  test('replaces the native cursor with a 1.5x sprite whose tip is the hotspot', async ({ page }) => {
    const errors = await freshApp(page)
    await page.goto('/')
    const { x, y } = await plainPoint(page)
    await page.mouse.move(x - 60, y - 60)
    await page.mouse.move(x, y, { steps: 5 })
    await page.waitForTimeout(150)

    await expect(page.locator('html')).toHaveClass(/art-cursor/)
    await expect(page.locator('canvas.art-brush-ink')).toHaveCount(1)
    await expect(page.locator('canvas.art-brush-cursor')).toHaveCount(1)
    expect(await page.evaluate(() => getComputedStyle(document.body).cursor)).toBe('none')

    const b = await bounds(page, '.art-brush-cursor')
    expect(Math.abs(b.minX - x), 'sprite starts at the pointer (x)').toBeLessThanOrEqual(8)
    expect(Math.abs(b.maxY - y), 'sprite starts at the pointer (y)').toBeLessThanOrEqual(8)
    // 34px brush at -42deg is ~23px tall above the tip; at 1.5x it is ~34px
    expect(y - b.minY, 'handle reaches ~34px above the tip').toBeGreaterThanOrEqual(30)
    expect(y - b.minY).toBeLessThanOrEqual(42)
    expect(errors).toEqual([])
  })

  test('a click blooms ink at the tip, and it dries on its own', async ({ page }) => {
    await freshApp(page)
    await page.goto('/')
    const { x, y } = await plainPoint(page)
    await page.mouse.move(x, y, { steps: 3 })
    await page.mouse.down()
    await page.waitForTimeout(120)
    expect(await inkDisplay(page)).toBe('block')
    const ink = await bounds(page, '.art-brush-ink')
    expect(ink.n).toBeGreaterThan(50)
    expect(Math.abs((ink.minX + ink.maxX) / 2 - x), 'bloom is centred on the tip').toBeLessThan(40)
    await page.mouse.up()
    await expect.poll(() => inkDisplay(page), { timeout: 3000 }).toBe('none')
  })

  test('moving while pressed leaves no ink trail', async ({ page }) => {
    await freshApp(page)
    await page.goto('/')
    // the hold-still bleed is random; pin it off so the assertion cannot flake
    await page.evaluate(() => {
      Math.random = () => 0.999
    })
    const { x, y } = await plainPoint(page)
    await page.mouse.move(x, y, { steps: 3 })
    await page.mouse.down()
    let widest = 0
    let sawBloom = false
    for (let i = 1; i <= 24; i++) {
      await page.mouse.move(x + i * 15, y + Math.sin(i / 3) * 20)
      const b = await bounds(page, '.art-brush-ink')
      if (b.n > 0) {
        sawBloom = true
        widest = Math.max(widest, b.maxX - b.minX)
      }
    }
    expect(sawBloom, 'the click bloom itself was observed (the test is not vacuous)').toBe(true)
    // the click bloom (+ droplets) is well under 90px wide; a 360px drag trail would be far wider
    expect(widest).toBeLessThan(90)
    await page.mouse.up()
  })

  test('hovering leaves short-lived dabs', async ({ page }) => {
    await freshApp(page)
    await page.goto('/')
    const { x, y } = await plainPoint(page)
    await page.mouse.move(x, y)
    await page.mouse.move(x + 150, y + 10, { steps: 15 })
    await page.waitForTimeout(80)
    expect(await inkDisplay(page)).toBe('block')
    await expect.poll(() => inkDisplay(page), { timeout: 3000 }).toBe('none')
  })

  test('the drawing canvas stays free of cursor ink', async ({ page }) => {
    const errors = await freshApp(page)
    await page.goto('/free-draw')
    const canvas = page.getByRole('img', { name: 'Drawing canvas' })
    await expect(canvas).toBeVisible()
    const box = (await canvas.boundingBox())!
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    await page.mouse.move(cx - 150, cy)
    await page.mouse.move(cx - 100, cy + 10, { steps: 6 })
    expect(await inkDisplay(page), 'no hover dabs over the canvas').toBe('none')
    await page.mouse.down()
    await page.mouse.move(cx + 100, cy + 30, { steps: 20 })
    await page.waitForTimeout(100)
    expect(await inkDisplay(page), 'no bloom or trail while drawing').toBe('none')
    await page.mouse.up()
    expect((await bounds(page, '.art-brush-cursor')).n, 'the brush sprite is still shown').toBeGreaterThan(100)
    expect(errors).toEqual([])
  })

  test('reduced motion keeps the sprite but drops the ink', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await freshApp(page)
    await page.goto('/')
    const { x, y } = await plainPoint(page)
    await page.mouse.move(x - 50, y)
    await page.mouse.move(x, y, { steps: 5 })
    await page.mouse.down()
    await page.waitForTimeout(150)
    expect(await inkDisplay(page)).toBe('none')
    expect((await bounds(page, '.art-brush-cursor')).n).toBeGreaterThan(100)
    await page.mouse.up()
  })

  test('turning the setting off restores the native cursor', async ({ page }) => {
    await freshApp(page, false)
    await page.goto('/')
    await page.mouse.move(300, 300, { steps: 4 })
    await expect(page.locator('canvas.art-brush-ink, canvas.art-brush-cursor')).toHaveCount(0)
    await expect(page.locator('html')).not.toHaveClass(/art-cursor/)
  })
})

test('touch devices get no custom cursor', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'coarse-pointer project only')
  await freshApp(page)
  await page.goto('/')
  await page.waitForTimeout(500)
  await expect(page.locator('canvas.art-brush-ink, canvas.art-brush-cursor')).toHaveCount(0)
})
