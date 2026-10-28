import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

async function freshChat(page: Page) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('chat-e2e')) return
    localStorage.clear()
    localStorage.setItem(
      'artspark:settings',
      JSON.stringify({
        state: { theme: 'light', language: 'en', motion: 'system', onboardingDone: true, customCursor: false },
        version: 1,
      }),
    )
    sessionStorage.setItem('chat-e2e', '1')
  })
  await page.goto('/chat')
  await expect(page.getByRole('textbox')).toBeVisible()
}

test('send streams a reply, stop keeps partial text, reload keeps history', async ({ page }) => {
  await freshChat(page)
  await page.getByRole('textbox').fill('Give me 5 drawing ideas for beginners')
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  const items = page.getByRole('region', { name: 'Messages' }).locator('ol.mx-auto > li')
  await expect(items).toHaveCount(2)
  await expect(items.nth(1)).toContainText('Here are five ideas')
  await page.getByRole('button', { name: 'Stop', exact: true }).click()
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('artspark:chat')!).state.conversations[0].messages[1])
  expect(stored.status).toBe('stopped')
  expect(stored.content.length).toBeGreaterThan(0)
  await page.reload()
  await expect(items).toHaveCount(2)
  await expect(items.nth(0)).toContainText('Give me 5 drawing ideas for beginners')
  await expect(items.nth(1)).toContainText('Reply stopped. Your received text has been kept.')
  const restored = await page.evaluate(() => JSON.parse(localStorage.getItem('artspark:chat')!).state.conversations[0].messages[1])
  expect(restored.content).toBe(stored.content)
  expect(restored.status).toBe('stopped')
})

test('template card navigates to /practice/:id', async ({ page }) => {
  await freshChat(page)
  await page.getByRole('textbox').fill('Give me 5 drawing ideas for beginners')
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  const template = page.getByRole('region', { name: 'Messages' }).locator('a[href^="/practice/"]')
  await expect(template).toBeVisible({ timeout: 15_000 })
  const path = await template.getAttribute('href')
  expect(path).toMatch(/^\/practice\/[a-z0-9-]+$/)
  await template.click()
  await expect(page).toHaveURL(new RegExp(`${path}$`))
  await expect(page.getByRole('img', { name: 'Drawing canvas' })).toBeVisible()
})

test('mode radiogroup works with arrow keys', async ({ page }) => {
  await freshChat(page)
  const ideas = page.getByRole('radio', { name: 'Find ideas' })
  await ideas.focus()
  await page.keyboard.press('ArrowRight')
  const colours = page.getByRole('radio', { name: 'Mix colours' })
  await expect(colours).toBeChecked()
  await expect(colours).toBeFocused()
  await page.keyboard.press('End')
  await expect(page.getByRole('radio', { name: 'Explore art' })).toBeChecked()
  await page.keyboard.press('ArrowRight')
  await expect(ideas).toBeChecked()
})

test('mobile: history sheet opens and returns focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await freshChat(page)
  for (const mode of ['Find ideas', 'Mix colours', 'Improve composition', 'Explore art']) {
    await expect(page.getByRole('radio', { name: mode })).toBeVisible()
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  const history = page.getByRole('button', { name: 'Conversations', exact: true })
  await history.focus()
  await history.click()
  const sheet = page.getByRole('dialog', { name: 'Conversations' })
  await expect(sheet).toBeVisible()
  await expect(sheet.getByRole('button', { name: 'Close', exact: true })).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(sheet.getByRole('button', { name: 'New conversation' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(sheet.getByRole('button', { name: 'Close', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(sheet).not.toBeVisible()
  await expect(history).toBeFocused()
})

test('reduced motion: no repeating animation on the mascot', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await freshChat(page)
  const mascots = page.locator('svg[data-state]')
  await expect(mascots.first()).toBeVisible()
  await expect
    .poll(() =>
      mascots.evaluateAll(
        (nodes) =>
          nodes
            .flatMap((node) => node.getAnimations({ subtree: true }))
            .filter((animation) => animation.effect?.getTiming().iterations === Infinity).length,
      ),
    )
    .toBe(0)
  for (const mascot of await mascots.all()) await expect(mascot).toHaveCSS('transform', 'none')
})

test('axe: no serious/critical violations on /chat in light and dark', async ({ page }) => {
  await freshChat(page)
  for (const theme of ['light', 'dark']) {
    await page.evaluate((theme) => {
      const settings = JSON.parse(localStorage.getItem('artspark:settings')!)
      settings.state.theme = theme
      localStorage.setItem('artspark:settings', JSON.stringify(settings))
    }, theme)
    await page.reload()
    await expect(page.getByRole('textbox')).toBeVisible()
    // H9: shared navigation, owned by the FE team
    const results = await new AxeBuilder({ page })
      .exclude('div[role="group"][aria-label="Language"] > button[type="button"][aria-label="English"][aria-pressed]')
      .exclude('div[role="group"][aria-label="Language"] > button[type="button"][aria-label="Tiếng Việt"][aria-pressed]')
      .exclude('nav[aria-label="Primary"] button[type="button"][aria-haspopup="menu"][aria-label="Account menu"]')
      .analyze()
    const violations = results.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    expect(violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([])
  }
})
