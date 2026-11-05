import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

/* Trace guide in Free Draw (mock chat transport): reached from a chat template card,
   shown on screen only, and never part of a download, a saved artwork or a draft. */

async function freshApp(page: Page) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('trace-e2e')) return
    localStorage.clear()
    localStorage.setItem(
      'artspark:settings',
      JSON.stringify({ state: { theme: 'light', language: 'en', onboardingDone: true, customCursor: false }, version: 1 }),
    )
    sessionStorage.setItem('trace-e2e', '1')
  })
}

/** Pixels darker than the paper shadow inside the visible page area of the view canvas. */
function guideInkOnScreen(page: Page) {
  return page.getByRole('img', { name: 'Drawing canvas' }).evaluate((canvas: HTMLCanvasElement) => {
    const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height)
    let dark = 0
    for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 0 && data[i] < 210 && data[i] > 120) dark++
    return dark
  })
}

/** RGBA of a PNG (as base64) decoded in the page, summarised as non-white count and a checksum. */
function pixelSummary(page: Page, base64: string) {
  return page.evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(bitmap, 0, 0)
    const { data } = ctx.getImageData(0, 0, bitmap.width, bitmap.height)
    let nonWhite = 0
    let sum = 0
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] < 250 || data[i + 1] < 250 || data[i + 2] < 250) nonWhite++
      sum = (sum + data[i] * 3 + data[i + 1] * 5 + data[i + 2] * 7 + (i % 9973)) % 2147483647
    }
    return { width: bitmap.width, height: bitmap.height, nonWhite, sum }
  }, base64)
}

async function downloadPng(page: Page) {
  await page.getByRole('button', { name: /Download/ }).click()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: 'Download PNG' }).click()])
  return (await readFile(await download.path())).toString('base64')
}

/** The full-size image of the only saved artwork, read back from IndexedDB as base64 PNG. */
function savedArtworkPng(page: Page) {
  return page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const open = indexedDB.open('artspark')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const store = open.result.transaction('files').objectStore('files')
          const keys = store.getAllKeys()
          keys.onsuccess = () => {
            const key = (keys.result as string[]).find((k) => k.startsWith('img:'))
            if (!key) return reject(new Error('no saved artwork'))
            const get = store.get(key)
            get.onsuccess = async () => {
              const buffer = new Uint8Array(await (get.result as Blob).arrayBuffer())
              let binary = ''
              for (const byte of buffer) binary += String.fromCharCode(byte)
              resolve(btoa(binary))
            }
          }
        }
      }),
  )
}

test('a chat template card opens Free Draw with a trace guide that can be hidden', async ({ page }) => {
  await freshApp(page)
  await page.goto('/chat')
  await page.getByRole('textbox').fill('Give me 5 drawing ideas for beginners')
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  const trace = page.getByRole('region', { name: 'Messages' }).getByRole('link', { name: 'Trace it yourself' })
  await expect(trace).toBeVisible({ timeout: 15_000 })
  const href = (await trace.getAttribute('href'))!
  const id = new URL(href, 'http://x').searchParams.get('guide')!
  expect(href).toMatch(/^\/free-draw\?guide=[a-z0-9-]+&prompt=/)
  await expect(page.getByRole('region', { name: 'Messages' }).getByRole('link', { name: 'Colour & get scored' })).toHaveAttribute(
    'href',
    `/practice/${id}`,
  )
  await trace.click()
  await expect(page).toHaveURL(new RegExp(`/free-draw\\?guide=${id}&prompt=`))

  const toggle = page.getByRole('button', { name: 'Trace guide' }).first()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  const box = (await toggle.boundingBox())!
  expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44)
  await expect.poll(() => guideInkOnScreen(page), { timeout: 10_000 }).toBeGreaterThan(500)
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await expect.poll(() => guideInkOnScreen(page)).toBeLessThan(50)
  await toggle.click()
  await expect.poll(() => guideInkOnScreen(page)).toBeGreaterThan(500)
})

test('unknown or locked guides show a plain Free Draw page', async ({ page }) => {
  await freshApp(page)
  for (const guide of ['invented', 'dragon']) {
    await page.goto(`/free-draw?guide=${guide}`)
    await expect(page.getByRole('img', { name: 'Drawing canvas' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Trace guide' })).toHaveCount(0)
  }
})

test('changing the guide in the same route isolates the canvas and drafts', async ({ page }) => {
  await freshApp(page)
  await page.goto('/free-draw?guide=cat')
  const canvas = page.getByRole('img', { name: 'Drawing canvas' })
  await expect.poll(() => guideInkOnScreen(page)).toBeGreaterThan(500)
  const area = (await canvas.boundingBox())!
  await page.mouse.move(area.x + area.width * 0.42, area.y + area.height * 0.4)
  await page.mouse.down()
  await page.mouse.move(area.x + area.width * 0.58, area.y + area.height * 0.6, { steps: 10 })
  await page.mouse.up()
  await canvas.evaluate((element) => (element.dataset.reviewGuide = 'cat'))

  await page.evaluate(() => {
    history.pushState(null, '', '/free-draw?guide=invented')
    dispatchEvent(new PopStateEvent('popstate'))
  })
  await expect(canvas).not.toHaveAttribute('data-review-guide', 'cat')
  await expect(page.getByRole('button', { name: 'Trace guide' })).toHaveCount(0)
  await expect.poll(() => guideInkOnScreen(page)).toBeLessThan(50)
  // Allow autosave to run: strokes from the guided page must not enter the plain draft.
  await page.waitForTimeout(5500)
  const plainDraft = await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('artspark')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const get = open.result.transaction('files').objectStore('files').get('draft:free:1200x900')
          get.onsuccess = () => {
            resolve(get.result ?? null)
            open.result.close()
          }
          get.onerror = () => reject(get.error)
        }
      }),
  )
  expect(plainDraft).toBeNull()
})

test('downloads and saved artworks never contain the guide', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'download menu is desktop-first')
  await freshApp(page)
  await page.goto('/free-draw?guide=cat&prompt=Curious%20Cat')
  const toggle = page.getByRole('button', { name: 'Trace guide' }).first()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(() => guideInkOnScreen(page), { timeout: 10_000 }).toBeGreaterThan(500)

  const empty = await pixelSummary(page, await downloadPng(page))
  expect(empty).toMatchObject({ width: 1200, height: 900, nonWhite: 0 })

  const canvas = page.getByRole('img', { name: 'Drawing canvas' })
  const area = (await canvas.boundingBox())!
  await page.mouse.move(area.x + 200, area.y + 200)
  await page.mouse.down()
  await page.mouse.move(area.x + 400, area.y + 260, { steps: 10 })
  await page.mouse.up()

  await page.getByRole('button', { name: 'Save to collection' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Save to collection' }).click()
  await expect(page.getByText('Saved to your collection')).toBeVisible({ timeout: 10_000 })
  const saved = await pixelSummary(page, await savedArtworkPng(page))
  // the first saved artwork unlocks badges; close each dialog before using the studio again
  await expect(async () => {
    const wonderful = page.getByRole('button', { name: 'Wonderful!' })
    if (await wonderful.count()) await wonderful.click()
    await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 500 })
  }).toPass({ timeout: 15_000 })

  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  const hidden = await pixelSummary(page, await downloadPng(page))
  expect(saved.nonWhite).toBeGreaterThan(0)
  expect(saved).toEqual(hidden)
})
