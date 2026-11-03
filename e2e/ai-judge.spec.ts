import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Locator, type Page } from '@playwright/test'

// Runs against the mock transport (VITE_CHAT_TRANSPORT=mock); the demo gallery provides a scored practice drawing.
const settings = (theme: 'light' | 'dark') =>
  JSON.stringify({ state: { theme, language: 'en', motion: 'system', onboardingDone: true, customCursor: false }, version: 1 })

async function seedDemoGallery(page: Page) {
  await page.addInitScript((value) => {
    if (sessionStorage.getItem('ai-judge-e2e')) return
    localStorage.clear()
    localStorage.setItem('artspark:settings', value)
    sessionStorage.setItem('ai-judge-e2e', '1')
  }, settings('light'))
  await page.goto('/collection')
  await page.getByRole('button', { name: 'Preview with demo artworks' }).click()
  await expect(page.getByText('Demo gallery loaded')).toBeVisible({ timeout: 60_000 })
}

async function openResult(page: Page) {
  await page.goto('/practice/result/demo_practice_1')
  const panel = page.getByRole('region', { name: "Muse's feedback" })
  await expect(panel).toBeVisible()
  await panel.scrollIntoViewIfNeeded()
  return panel
}

async function seriousAxe(page: Page, panel: Locator) {
  await panel.evaluate((element) => element.setAttribute('data-axe-scope', 'ai-judge'))
  const results = await new AxeBuilder({ page }).include('[data-axe-scope="ai-judge"]').analyze()
  return results.violations
    .filter(({ impact }) => impact === 'serious' || impact === 'critical')
    .map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) }))
}

async function fitsViewport(panel: Locator) {
  const box = (await panel.boundingBox())!
  const width = await panel.evaluate(() => window.innerWidth)
  return box.x >= 0 && box.x + box.width <= width && (await panel.evaluate((el) => el.scrollWidth <= el.clientWidth))
}

test('practice result: Muse feedback waits for the learner, then shows an accessible card', async ({ page }) => {
  test.setTimeout(150_000)
  const pageErrors: string[] = []
  const judgeRequests: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.endsWith('/v1/ai/judge/feedback')) judgeRequests.push(request.url())
  })
  await seedDemoGallery(page)

  for (const theme of ['light', 'dark'] as const) {
    await page.evaluate((value) => localStorage.setItem('artspark:settings', value), settings(theme))
    const panel = await openResult(page)
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
    const ask = panel.getByRole('button', { name: 'Ask Muse for feedback' })
    await expect(ask).toBeVisible()
    await expect(panel.getByText(/sent through the Art Spark server to OpenAI/)).toBeVisible()
    await expect(panel.getByRole('status')).toHaveText('')
    await expect(panel.getByRole('heading', { name: 'Try it now' })).toHaveCount(0)
    await page.waitForTimeout(500)
    expect(judgeRequests, `${theme}: nothing is sent before the click`).toEqual([])
    expect((await ask.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    expect(await seriousAxe(page, panel), `${theme} idle axe`).toEqual([])

    await ask.click()
    await expect(panel.getByRole('status')).toContainText('Muse is looking at your drawing')
    await expect(panel.getByRole('heading', { name: 'Try it now' })).toBeVisible()
    await expect(panel.getByRole('list', { name: 'What works' }).getByRole('listitem')).not.toHaveCount(0)
    await expect(panel.getByRole('list', { name: 'Tips' }).getByRole('listitem')).not.toHaveCount(0)
    await expect(panel.getByText('Muse · AI — the score comes from the formula')).toBeVisible()
    await expect(panel.getByRole('status')).toHaveText("Muse's feedback is ready.")
    expect(await fitsViewport(panel), `${theme} panel fits the viewport`).toBe(true)
    expect(await seriousAxe(page, panel), `${theme} feedback axe`).toEqual([])
    await panel.screenshot({ path: test.info().outputPath(`${theme}-feedback.png`) })
  }
  expect(pageErrors).toEqual([])
})
