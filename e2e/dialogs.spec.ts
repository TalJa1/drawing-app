/* A dialog that is closed must give the page back: it scrolls again, nothing covers it, no dialog is left over.
   (Seen before: deleting an artwork closed two nested dialogs at once and left `body { overflow: hidden }` on for good.)
   Every dialog that can be reached without an account is opened and closed in each way a person can close it
   (Escape, the backdrop, the close button, a button inside it, leaving the page, rotating the phone), also in quick
   succession. Same three engines as layout.spec.ts. */
import { expect, test, type Page } from '@playwright/test'
import { open } from './support/app.js'

const DIALOG = '[role="dialog"][aria-modal="true"]'

/** The page is free: no dialog, no scroll lock, the wheel scrolls it, and no full-screen layer sits over its middle. */
async function expectPageFree(page: Page, label: string) {
  await expect(page.locator(DIALOG), `${label}: dialog gone`).toHaveCount(0, { timeout: 4000 })
  const lock = await page.evaluate(() => ({
    inline: document.body.style.overflow,
    body: getComputedStyle(document.body).overflowY,
    html: getComputedStyle(document.documentElement).overflowY,
    inert: document.querySelectorAll('[inert]').length,
  }))
  expect(lock.inline, `${label}: body.style.overflow`).toBe('')
  expect(lock.body, `${label}: computed overflow of body`).not.toBe('hidden')
  expect(lock.html, `${label}: computed overflow of html`).not.toBe('hidden')
  expect(lock.inert, `${label}: [inert] elements`).toBe(0)

  const covering = await page.evaluate(() => {
    for (let n: Element | null = document.elementFromPoint(innerWidth / 2, innerHeight / 2); n; n = n.parentElement) {
      const r = n.getBoundingClientRect()
      if (getComputedStyle(n).position === 'fixed' && r.width >= innerWidth - 1 && r.height >= innerHeight - 1)
        return n.className.toString().slice(0, 80)
    }
    return null
  })
  expect(covering, `${label}: a full-screen layer over the page`).toBeNull()

  const tall = await page.evaluate(() => document.documentElement.scrollHeight > innerHeight + 80)
  if (tall) {
    await page.evaluate(() => scrollTo(0, 0))
    await page.mouse.move(100, 300)
    await page.mouse.wheel(0, 400)
    await expect
      .poll(() => page.evaluate(() => scrollY), { message: `${label}: the wheel scrolls the page`, timeout: 4000 })
      .toBeGreaterThan(50)
    await page.evaluate(() => scrollTo(0, 0))
  }
}
const closeButton = (page: Page) => page.locator(`${DIALOG} button[aria-label="Đóng"]`).first()

test.describe('filters sheet on a phone (/practice)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await open(page, '/practice')
  })
  const openIt = async (page: Page) => {
    await page.getByRole('button', { name: /^Bộ lọc/ }).click()
    await expect(page.locator(DIALOG)).toBeVisible()
    expect(await page.evaluate(() => document.body.style.overflow), 'locked while open').toBe('hidden')
  }

  test('Escape', async ({ page }) => {
    await openIt(page)
    await page.keyboard.press('Escape')
    await expectPageFree(page, 'Escape')
  })
  test('the backdrop', async ({ page }) => {
    await openIt(page)
    await page.mouse.click(187, 30)
    await expectPageFree(page, 'backdrop')
  })
  test('the close button', async ({ page }) => {
    await openIt(page)
    await closeButton(page).click()
    await expectPageFree(page, 'close button')
  })
  test('the Done button inside it', async ({ page }) => {
    await openIt(page)
    await page.locator(`${DIALOG}`).getByRole('button', { name: 'Xong' }).click()
    await expectPageFree(page, 'Done')
  })
  test('opened and closed again and again', async ({ page }) => {
    for (let i = 0; i < 6; i++) {
      await openIt(page)
      await page.keyboard.press('Escape')
    }
    await expectPageFree(page, 'six times')
  })
  test('leaving the page while it is open', async ({ page }) => {
    await openIt(page)
    await page.evaluate(() => {
      history.pushState({}, '', '/learn')
      dispatchEvent(new PopStateEvent('popstate'))
    })
    await expect(page).toHaveURL(/\/learn$/)
    await expectPageFree(page, 'route change')
  })
  test('turning the phone to landscape and back while it is open', async ({ page }) => {
    await openIt(page)
    await page.setViewportSize({ width: 1024, height: 600 })
    await expectPageFree(page, 'wide')
    await page.setViewportSize({ width: 375, height: 812 })
    await expectPageFree(page, 'narrow again (it must not open by itself)')
  })
})

test.describe('menu on a phone (/)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await open(page, '/')
  })
  const openIt = async (page: Page) => {
    await page.getByRole('button', { name: 'Mở menu' }).click()
    await expect(page.locator(DIALOG)).toBeVisible()
  }
  test('Escape', async ({ page }) => {
    await openIt(page)
    await page.keyboard.press('Escape')
    await expectPageFree(page, 'menu Escape')
  })
  test('the backdrop', async ({ page }) => {
    await openIt(page)
    await page.mouse.click(8, 400)
    await expectPageFree(page, 'menu backdrop')
  })
  test('choosing a link (the page changes, the menu closes)', async ({ page }) => {
    await openIt(page)
    await page.locator(DIALOG).getByRole('link', { name: 'Luyện tập' }).click()
    await expect(page).toHaveURL(/\/practice/)
    await expectPageFree(page, 'menu link')
  })
  test('the browser Back button while it is open, then Escape', async ({ page }) => {
    await page.evaluate(() => {
      history.pushState({}, '', '/learn')
      dispatchEvent(new PopStateEvent('popstate'))
    })
    await expect(page).toHaveURL(/\/learn$/)
    await openIt(page)
    await page.goBack()
    await expect(page).toHaveURL(/\/$/)
    if (await page.locator(DIALOG).count()) await page.keyboard.press('Escape')
    await expectPageFree(page, 'Back then Escape')
  })
})

test.describe('studio dialogs (/free-draw)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await open(page, '/free-draw')
  })
  test('shortcuts: ? opens it, Escape and the backdrop close it, also in quick succession', async ({ page }) => {
    for (const how of ['Escape', 'backdrop', 'Escape'] as const) {
      await page.keyboard.press('?')
      await expect(page.locator(DIALOG)).toBeVisible()
      if (how === 'Escape') await page.keyboard.press('Escape')
      else await page.mouse.click(20, 450)
      await expectPageFree(page, `shortcuts ${how}`)
    }
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('?')
      await page.keyboard.press('Escape')
    }
    await expectPageFree(page, 'shortcuts x5')
  })
})

test.describe('first-visit tour (/free-draw)', () => {
  test('skipping it with Escape leaves the page free', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await open(page, '/free-draw', { onboardingDone: false })
    await expect(page.locator(DIALOG).first()).toBeVisible()
    await page.keyboard.press('Escape')
    await expectPageFree(page, 'tour Escape')
  })
})
