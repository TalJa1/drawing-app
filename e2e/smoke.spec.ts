import { expect, test, type Page } from '@playwright/test'

const settings = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({ state: { theme: 'light', language: 'en', onboardingDone: true, customCursor: false, ...extra }, version: 1 })

async function freshApp(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.addInitScript((s) => {
    if (sessionStorage.getItem('e2e')) return
    localStorage.clear()
    localStorage.setItem('artspark:settings', s)
    sessionStorage.setItem('e2e', '1')
  }, settings())
  return errors
}

test('landing page loads with hero and CTAs', async ({ page }) => {
  const errors = await freshApp(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Draw.')
  await expect(page.getByRole('link', { name: 'Start drawing' }).first()).toBeVisible()
  expect(errors).toEqual([])
})

test('practice: open a template, draw, submit and see the result', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'covered on desktop; mobile layout checked separately')
  const errors = await freshApp(page)
  await page.goto('/practice')
  await page.getByRole('link', { name: /Sitting Fox/ }).click()
  await expect(page).toHaveURL(/\/practice\/fox/)
  const canvas = page.getByRole('img', { name: 'Drawing canvas' })
  await expect(canvas).toBeVisible()
  const box = (await canvas.boundingBox())!
  // a marker stroke
  await page.keyboard.press('m')
  await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.6)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.65, { steps: 12 })
  await page.mouse.up()
  // a bucket fill inside the fox's body
  await page.keyboard.press('g')
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.74)
  await page.getByRole('button', { name: 'Submit to AI Judge' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Submit' }).click()
  await expect(page.getByText(/Studying your linework|Measuring proportions|Reading your colour harmony|Consulting the old masters|Writing a little note/)).toBeVisible()
  await page.waitForURL(/\/practice\/result\//, { timeout: 20_000 })
  await expect(page.getByText("The judge's verdict")).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Strengths' })).toBeVisible()
  expect(errors).toEqual([])
})

test('free draw exports a PNG', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'download menu is desktop-first')
  await freshApp(page)
  await page.goto('/free-draw')
  const canvas = page.getByRole('img', { name: 'Drawing canvas' })
  const box = (await canvas.boundingBox())!
  await page.mouse.move(box.x + 200, box.y + 200)
  await page.mouse.down()
  await page.mouse.move(box.x + 400, box.y + 260, { steps: 10 })
  await page.mouse.up()
  await page.getByRole('button', { name: /Download/ }).click()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: 'Download PNG' }).click()])
  expect(download.suggestedFilename()).toMatch(/\.png$/)
})

test('language switch translates the interface', async ({ page }) => {
  await freshApp(page)
  await page.goto('/learn')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Every way')
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('artspark:settings')!)
    s.state.language = 'vi'
    localStorage.setItem('artspark:settings', JSON.stringify(s))
  })
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Mọi cách')
})
