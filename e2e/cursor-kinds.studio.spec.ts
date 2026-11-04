/* The brush cursor says what the pointer is about to do.

   - In the drawing studio the sprite is the glyph of the chosen tool (a pencil for the pencil, an eraser for the eraser, ...) and
     follows a tool change from the keyboard, Space included (the hand).
   - The sprite's pigment is the colour that the stroke will really get: the studio's colour in the studio, the
     doodle pad's next ink on the home page.
   - A custom list replaces the browser's own drop-down (which is drawn outside the page, so the cursor could not reach it):
     the cursor stays the cursor over it, Escape closes only the list, the choice reaches the page.
   The sprite names what it shows in `data-kind` / `data-color` on `canvas.art-brush-cursor`. */
import { expect, test, type Page } from '@playwright/test'
import { open } from './support/app.js'

const SPRITE = 'canvas.art-brush-cursor'
const DIALOG = '[role="dialog"][aria-modal="true"]'

const kindOf = (page: Page) => page.locator(SPRITE).getAttribute('data-kind')
const colorOf = (page: Page) => page.locator(SPRITE).getAttribute('data-color')

/** Moves the pointer over `target` in two steps (the engine reads the hints of the element under the pointer on each move). */
async function hover(page: Page, selector: string, dx = 0.5, dy = 0.5) {
  const b = (await page.locator(selector).first().boundingBox())!
  await page.mouse.move(b.x + b.width * dx, b.y + b.height * dy)
  await page.mouse.move(b.x + b.width * dx + 6, b.y + b.height * dy + 4, { steps: 2 })
}

test.describe('studio: the cursor follows the tool', () => {
  const CASES: [key: string, kind: string][] = [
    ['b', 'pencil'],
    ['p', 'pen'],
    ['m', 'marker'],
    ['w', 'brush'],
    ['a', 'airbrush'],
    ['c', 'chalk'],
    ['g', 'bucket'],
    ['e', 'eraser'],
    ['s', 'smudge'],
    ['i', 'eyedropper'],
    ['l', 'crosshair'],
    ['r', 'crosshair'],
    ['o', 'crosshair'],
    ['z', 'zoom'],
  ]

  test('every tool shortcut changes the sprite, and Space turns it into the hand while held', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await open(page, '/free-draw', { customCursor: true })
    const stage = '[data-cursor-kind] canvas'
    await hover(page, stage)
    await expect(page.locator(SPRITE)).toHaveCount(1)

    const seen = new Set<string>()
    for (const [key, kind] of CASES) {
      await page.keyboard.press(key)
      await hover(page, stage, 0.4 + Math.random() * 0.2)
      await expect.poll(() => kindOf(page), { message: `after "${key}"` }).toBe(kind)
      seen.add(kind)
    }
    // the sprites differ between tools, they are not one picture with a different label
    expect(seen.size).toBeGreaterThanOrEqual(10)

    await page.keyboard.press('b')
    await hover(page, stage)
    await expect.poll(() => kindOf(page)).toBe('pencil')
    await page.keyboard.down('Space')
    await hover(page, stage, 0.45)
    await expect.poll(() => kindOf(page), { message: 'Space held' }).toBe('hand')
    await page.keyboard.up('Space')
    await hover(page, stage, 0.55)
    await expect.poll(() => kindOf(page), { message: 'Space released' }).toBe('pencil')
  })

  test('the sprite carries the studio colour', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await open(page, '/free-draw', { customCursor: true })
    const stage = '[data-cursor-kind] canvas'
    await hover(page, stage)
    // two different palette swatches, each one becomes the colour of the cursor
    const swatches = page.locator('button[aria-label^="#"]:visible')
    expect(await swatches.count()).toBeGreaterThan(3)
    const picked = new Set<string>()
    for (const i of [1, 3]) {
      const hex = (await swatches.nth(i).getAttribute('aria-label'))!.toLowerCase()
      await swatches.nth(i).click()
      await hover(page, stage, 0.3 + i / 20)
      await expect.poll(() => colorOf(page), { message: `swatch ${hex}` }).toBe(hex)
      picked.add(hex)
    }
    expect(picked.size).toBe(2)
  })
})

test.describe('home: the doodle pad cursor is the ink of the next stroke', () => {
  test('the sprite shows the colour the stroke is drawn in, and moves on to the next ink after each stroke', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await open(page, '/', { customCursor: true, motion: 'full' })
    const pad = 'canvas[data-cursor="brush"][role="img"]'
    await page.locator(pad).first().scrollIntoViewIfNeeded()
    await hover(page, pad)
    const ink = () => page.locator(pad).first().getAttribute('data-cursor-color')

    const first = (await ink())!.toLowerCase()
    await expect.poll(() => colorOf(page), { message: 'before the first stroke' }).toBe(first)

    const b = (await page.locator(pad).first().boundingBox())!
    await page.mouse.move(b.x + b.width * 0.3, b.y + b.height * 0.4)
    await page.mouse.down()
    await page.mouse.move(b.x + b.width * 0.5, b.y + b.height * 0.55, { steps: 8 })
    await page.mouse.up()
    await page.mouse.move(b.x + b.width * 0.6, b.y + b.height * 0.5, { steps: 3 })

    const second = (await ink())!.toLowerCase()
    expect(second, 'the next ink is another colour').not.toBe(first)
    await expect.poll(() => colorOf(page), { message: 'after the first stroke' }).toBe(second)
  })
})

test.describe('select: the list is the app’s own', () => {
  test('with the custom cursor on, opening, choosing and closing keep the cursor', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await open(page, '/practice', { customCursor: true })
    const combo = page.getByRole('combobox').first()
    await expect(combo).toBeVisible()
    await expect(page.locator('select')).toHaveCount(0)
    const before = (await combo.textContent())!.trim()

    await combo.click()
    const list = page.getByRole('listbox')
    await expect(list).toBeVisible()
    await expect(combo).toHaveAttribute('aria-expanded', 'true')

    // over an option the pointer is still the brush cursor (the native pop-up would have shown the arrow)
    const options = list.getByRole('option')
    expect(await options.count()).toBeGreaterThan(1)
    const target = options.nth(1)
    const tb = (await target.boundingBox())!
    await page.mouse.move(tb.x + 20, tb.y + tb.height / 2)
    await page.mouse.move(tb.x + 26, tb.y + tb.height / 2 + 1, { steps: 2 })
    expect(await target.evaluate((el) => getComputedStyle(el).cursor), 'native cursor over an option').toBe('none')
    await expect(page.locator(SPRITE)).toHaveCSS('visibility', 'visible')

    // the list is above everything and lies inside the window
    const lb = (await list.boundingBox())!
    expect(lb.x).toBeGreaterThanOrEqual(0)
    expect(lb.x + lb.width).toBeLessThanOrEqual(1440)
    expect(lb.y + lb.height).toBeLessThanOrEqual(900)

    await target.click()
    await expect(list).toBeHidden()
    await expect(combo).toHaveAttribute('aria-expanded', 'false')
    expect((await combo.textContent())!.trim(), 'the choice reaches the control').not.toBe(before)
    await expect(combo, 'the focus is back on the control').toBeFocused()
  })

  test('hovering an option highlights it: a tint, a short transition, the label leans in', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await open(page, '/practice', { customCursor: true, motion: 'full' })
    const combo = page.getByRole('combobox').first()
    await combo.click()
    const options = page.getByRole('listbox').getByRole('option')
    const style = (i: number) =>
      options.nth(i).evaluate((el) => {
        const label = el.querySelector('span')!
        return {
          bg: getComputedStyle(el).backgroundColor,
          transition: getComputedStyle(el).transitionDuration,
          x: parseFloat(getComputedStyle(label).translate) || 0, // Tailwind v4 moves with `translate`, not `transform`
          active: el.hasAttribute('data-active'),
        }
      })
    const b = (await options.nth(2).boundingBox())!
    await page.mouse.move(b.x + 30, b.y + b.height / 2)
    await page.mouse.move(b.x + 34, b.y + b.height / 2 + 1, { steps: 2 })
    await expect.poll(async () => (await style(2)).active).toBe(true)
    // the transition runs to its end, then the label has moved and the row is tinted (not transparent)
    await expect.poll(async () => (await style(2)).x, { message: 'label leans in' }).toBeGreaterThan(2)
    const hot = await style(2)
    expect(hot.bg, 'hovered row is tinted').not.toBe('rgba(0, 0, 0, 0)')
    expect(hot.transition, 'it eases, it does not jump').not.toMatch(/^0s(, 0s)*$/)
    const idle = await style(0)
    expect(idle.active).toBe(false)
    expect(idle.x, 'another row stays put').toBe(0)

    // leaving the row hands the highlight to the next one: only one row is lit at a time
    const c = (await options.nth(0).boundingBox())!
    await page.mouse.move(c.x + 30, c.y + c.height / 2)
    await page.mouse.move(c.x + 34, c.y + c.height / 2 + 1, { steps: 2 })
    await expect.poll(async () => (await style(0)).active).toBe(true)
    expect((await style(2)).active).toBe(false)
    await expect.poll(async () => (await style(2)).x, { message: 'label returns' }).toBe(0)
  })

  test('keyboard: arrows move, Enter chooses, Escape closes without choosing', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await open(page, '/practice', { customCursor: true })
    const combo = page.getByRole('combobox').first()
    const before = (await combo.textContent())!.trim()
    await combo.focus()
    await page.keyboard.press('ArrowDown') // opens
    const list = page.getByRole('listbox')
    await expect(list).toBeVisible()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Escape')
    await expect(list).toBeHidden()
    expect((await combo.textContent())!.trim(), 'Escape does not choose').toBe(before)
    await expect(combo).toBeFocused()

    await page.keyboard.press('ArrowDown')
    await expect(list).toBeVisible()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await expect(list).toBeHidden()
    expect((await combo.textContent())!.trim(), 'Enter chooses').not.toBe(before)
  })

  test('inside a sheet, Escape closes the list first and the sheet second; the page is free afterwards', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await open(page, '/practice', { customCursor: true })
    await page
      .getByRole('button', { name: /filters|bộ lọc/i })
      .first()
      .click()
    const dialog = page.locator(DIALOG)
    await expect(dialog).toBeVisible()
    const combo = dialog.getByRole('combobox').first()
    await combo.click()
    const list = page.getByRole('listbox')
    await expect(list).toBeVisible()
    // the list sits above the sheet
    const above = await list.evaluate((el) => {
      const r = el.getBoundingClientRect()
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
      return !!hit && el.contains(hit)
    })
    expect(above, 'the list is on top of the sheet').toBe(true)

    await page.keyboard.press('Escape')
    await expect(list).toBeHidden()
    // a sheet that did close would still be in the page for the length of its exit animation: look again after that
    await page.waitForTimeout(700)
    await expect(dialog, 'the sheet stays open after the first Escape').toHaveCount(1)
    await expect(dialog).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    const lock = await page.evaluate(() => ({
      inline: document.body.style.overflow,
      body: getComputedStyle(document.body).overflowY,
      inert: document.querySelectorAll('[inert]').length,
    }))
    expect(lock.inline).toBe('')
    expect(lock.body).not.toBe('hidden')
    expect(lock.inert).toBe(0)
  })

  test('with the custom cursor off, the browser’s own select is kept', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await open(page, '/practice', { customCursor: false })
    await expect(page.locator('select').first()).toBeVisible()
    await expect(page.getByRole('listbox')).toHaveCount(0)
  })
})
