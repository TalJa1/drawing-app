import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Locator, type Page } from '@playwright/test'

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

async function seedChatCards(page: Page, failed = false) {
  await page.evaluate((failed) => {
    const createdAt = new Date().toISOString()
    const message = {
      id: 'touch-reply',
      role: 'assistant',
      turnId: 'touch-turn',
      createdAt,
      content: 'Try drawing three simple shapes.',
      attachments: [],
      status: failed ? 'failed' : 'completed',
      ...(failed ? { errorCode: 'network' } : {}),
      cards: [
        { type: 'palette', name: 'Touch palette', colors: ['#112233', '#445566', '#778899', '#AABBCC', '#DDEEFF', '#112244'] },
        { type: 'idea', title: 'Simple shapes', description: 'Draw three shapes.', difficulty: 'beginner', minutes: 10 },
      ],
      variants: [{ content: 'Draw two shapes.', cards: [], status: 'completed', createdAt }],
    }
    localStorage.setItem(
      'artspark:chat',
      JSON.stringify({
        version: 2,
        state: {
          activeId: 'touch-conversation',
          draft: null,
          drafts: {},
          conversations: [
            {
              id: 'touch-conversation',
              title: 'Touch conversation',
              mode: 'ideas',
              createdAt,
              updatedAt: createdAt,
              messages: [
                {
                  id: 'touch-question',
                  role: 'user',
                  turnId: 'touch-turn',
                  createdAt,
                  content: 'Suggest a palette.',
                  cards: [],
                  attachments: [],
                },
                message,
              ],
            },
          ],
        },
      }),
    )
  }, failed)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Send palette to studio' })).toBeVisible()
}

async function smallChatTargets(scope: Locator) {
  return scope.locator('button, a[href], input:not([type="file"]), textarea, summary').evaluateAll((nodes) =>
    nodes
      .filter((node) => node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden')
      .flatMap((node) => {
        const box = node.getBoundingClientRect()
        return box.width < 44 || box.height < 44
          ? [{ name: node.getAttribute('aria-label') || node.textContent?.trim(), width: box.width, height: box.height }]
          : []
      }),
  )
}

test('touch layouts: every chat control is at least 44 by 44', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await freshChat(page)
  const chat = page.locator('section[aria-label]').filter({ has: page.locator('#chat-input') })
  const failures = []
  failures.push({ state: 'welcome', targets: await smallChatTargets(chat) })
  await seedChatCards(page)
  failures.push({ state: 'cards', targets: await smallChatTargets(chat) })
  await page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem('artspark:chat')!)
    stored.state.conversations[0].messages[0].attachments = [
      { kind: 'image', id: 'context-image', name: 'Context.jpg', blobKey: 'chat:context-image:full' },
    ]
    localStorage.setItem('artspark:chat', JSON.stringify(stored))
  })
  await page.reload()
  await expect(page.getByRole('button', { name: 'Clear image context' })).toBeVisible()
  failures.push({ state: 'image context', targets: await smallChatTargets(chat) })
  await seedChatCards(page, true)
  failures.push({ state: 'retry', targets: await smallChatTargets(chat) })
  await page.getByRole('button', { name: 'Conversations', exact: true }).click()
  const sheet = page.getByRole('dialog', { name: 'Conversations' })
  await expect(sheet).toBeVisible()
  await expect(sheet).toHaveCSS('transform', 'none')
  failures.push({ state: 'history', targets: await smallChatTargets(sheet) })
  await sheet.getByRole('button', { name: 'Rename conversation', exact: true }).click()
  failures.push({ state: 'rename', targets: await smallChatTargets(sheet) })
  await sheet.getByRole('textbox', { name: 'Rename conversation' }).press('Enter')
  await sheet.getByRole('button', { name: 'Delete conversation', exact: true }).click()
  const deletion = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Cancel', exact: true }) })
  await expect(deletion).toBeVisible()
  await expect(deletion).toHaveCSS('transform', 'none')
  failures.push({ state: 'delete', targets: await smallChatTargets(deletion) })
  await deletion.getByRole('button', { name: 'Cancel', exact: true }).click()
  await sheet.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(sheet).not.toBeVisible()
  await page.getByRole('button', { name: 'Attach an image', exact: true }).click()
  const picker = page.getByRole('dialog').filter({ has: page.locator('input[type="file"]') })
  await expect(picker).toBeVisible()
  await expect(picker).toHaveCSS('transform', 'none')
  failures.push({ state: 'attachments', targets: await smallChatTargets(picker) })
  expect(failures.filter(({ targets }) => targets.length)).toEqual([])
})

test('placeholder contrast is at least 4.5 on the rendered light and dark background', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 390, height: 844 })
  await freshChat(page)
  for (const theme of ['light', 'dark']) {
    await page.evaluate((theme) => {
      const stored = JSON.parse(localStorage.getItem('artspark:settings')!)
      stored.state.theme = theme
      localStorage.setItem('artspark:settings', JSON.stringify(stored))
    }, theme)
    await page.reload()
    const input = page.locator('#chat-input')
    await expect(input).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
    await expect(input.locator('xpath=ancestor::main')).toHaveCSS('opacity', '1')
    await page.evaluate(() => document.fonts.ready)
    const foreground = await input.evaluate((node) => {
      const style = getComputedStyle(node, '::placeholder')
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 1
      const context = canvas.getContext('2d')!
      context.fillStyle = style.color
      context.fillRect(0, 0, 1, 1)
      const rgba = [...context.getImageData(0, 0, 1, 1).data]
      rgba[3] *= Number(style.opacity)
      const box = node.getBoundingClientRect()
      return { rgba, x: box.x + 20, y: box.y + 20, width: box.width - 40 }
    })
    const hiddenText = await page.addStyleTag({ content: '#chat-input::placeholder { color: transparent !important; }' })
    const screenshot = await page.screenshot({ scale: 'css' })
    await hiddenText.evaluate((node) => node.parentNode?.removeChild(node))
    const ratio = await page.evaluate(
      async ({ data, foreground }) => {
        const image = new Image()
        image.src = `data:image/png;base64,${data}`
        await image.decode()
        const canvas = document.createElement('canvas')
        canvas.width = image.width
        canvas.height = image.height
        const context = canvas.getContext('2d')!
        context.drawImage(image, 0, 0)
        const luminance = (rgb: number[]) =>
          rgb.slice(0, 3).reduce((sum, value, index) => {
            const channel = value / 255
            return sum + (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][index]
          }, 0)
        return Math.min(
          ...[0.15, 0.5, 0.85].map((position) => {
            const background = [
              ...context.getImageData(Math.round(foreground.x + foreground.width * position), Math.round(foreground.y), 1, 1).data,
            ]
            const alpha = foreground.rgba[3] / 255
            const composite = foreground.rgba.slice(0, 3).map((value, index) => value * alpha + background[index] * (1 - alpha))
            const a = luminance(composite)
            const b = luminance(background)
            return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
          }),
        )
      },
      { data: screenshot.toString('base64'), foreground },
    )
    console.log(`Placeholder ${theme}: ${ratio.toFixed(3)}:1`)
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  }
})

test('mode picker offers every mode across short and tall mobile viewports', async ({ page }) => {
  test.setTimeout(90_000)
  for (const width of [320, 360, 390])
    for (const height of [430, 568, 667, 844]) {
      await page.setViewportSize({ width, height })
      await freshChat(page)
      await page.evaluate(() => {
        localStorage.removeItem('artspark:chat')
      })
      await page.reload()
      for (const hasMessages of [false, true]) {
        if (hasMessages) await seedChatCards(page)
        if (hasMessages || height <= 700) {
          const picker = page.getByRole('combobox', { name: 'Muse mode' })
          await expect(picker).toBeVisible()
          await expect(picker.locator('option')).toHaveCount(4)
          for (const mode of ['ideas', 'colour', 'composition', 'history']) {
            await picker.selectOption(mode)
            await expect(picker).toHaveValue(mode)
          }
          const bounds = await picker.boundingBox()
          expect(bounds!.x).toBeGreaterThanOrEqual(0)
          expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width)
        } else {
          const radios = page.getByRole('radio')
          await expect(radios).toHaveCount(4)
          for (const radio of await radios.all()) {
            await expect(radio).toBeInViewport()
            const bounds = await radio.boundingBox()
            expect(bounds!.x).toBeGreaterThanOrEqual(0)
            expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width)
          }
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      }
    }
})

test('new empty conversation keeps the mode chosen in the select', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 667 })
  await freshChat(page)
  const picker = page.getByRole('combobox', { name: 'Muse mode' })
  await picker.selectOption('colour')
  await page.getByRole('button', { name: 'Conversations', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'New conversation' }).click()
  await expect(picker).toHaveValue('colour')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('artspark:chat')!).state.conversations)).toEqual([])
})

test('card details are readable without hover and critique uses its own image across viewports', async ({ page }) => {
  for (const width of [390, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await freshChat(page)
    await seedChatCards(page)
    await page.mouse.move(0, 0)
    for (const hex of ['#112233', '#445566', '#778899', '#AABBCC', '#DDEEFF', '#112244']) {
      const swatch = page.getByRole('button', { name: new RegExp(hex, 'i') })
      const label = swatch.getByText(hex, { exact: true })
      await expect(label).toHaveCSS('opacity', '1')
      const box = await swatch.boundingBox()
      expect(box!.width).toBeGreaterThanOrEqual(44)
      expect(box!.height).toBeGreaterThanOrEqual(56)
    }
    await page.evaluate(() => {
      const stored = JSON.parse(localStorage.getItem('artspark:chat')!)
      const current = stored.state.conversations[0]
      const canvas = document.createElement('canvas')
      canvas.width = 100
      canvas.height = 80
      current.messages[0].attachments = ['older', 'selected', 'newer'].map((id) => ({
        kind: 'image',
        id,
        name: `${id}.jpg`,
        src: canvas.toDataURL('image/jpeg'),
      }))
      current.messages[1].cards = [
        {
          type: 'critique',
          imageId: 'selected',
          observations: ['Clear shapes'],
          strengths: ['Good contrast'],
          priorities: ['Soften edges'],
          exercise: 'Try three thumbnails',
        },
      ]
      localStorage.setItem('artspark:chat', JSON.stringify(stored))
    })
    await page.reload()
    const card = page.locator('[data-card-type="critique"]')
    await expect(card.getByRole('img', { name: 'selected.jpg' })).toBeVisible()
    await expect(card.getByText('selected.jpg', { exact: true })).toBeVisible()
    await expect(card.getByRole('img', { name: 'newer.jpg' })).toHaveCount(0)
    const reply = page.getByRole('region', { name: 'Messages' }).locator('ol.mx-auto > li').last()
    const bubble = reply
      .getByText('Try drawing three simple shapes.', { exact: true })
      .locator('xpath=ancestor::div[contains(@class,"rounded-tl-md")]')
    expect(Math.abs((await card.boundingBox())!.width - (await bubble.boundingBox())!.width)).toBeLessThanOrEqual(1)
  }
})

test('mobile new conversation control stops a reply and avoids duplicate empty conversations', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await freshChat(page)
  const create = page.locator('section').getByRole('button', { name: 'New conversation' })
  await expect(create).toBeVisible()
  const bounds = await create.boundingBox()
  expect(bounds!.width).toBeGreaterThanOrEqual(44)
  expect(bounds!.height).toBeGreaterThanOrEqual(44)
  await page.getByRole('textbox').fill('Give me 5 drawing ideas for beginners')
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeVisible()
  await create.click()
  await create.click()
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('artspark:chat')!).state.conversations.length)).toBe(1)
})

test('cards arriving before text show an honest reply status in one live region', async ({ page }) => {
  await page.route('**/src/api/ai/mockTransport.ts*', async (route) => {
    const response = await route.fetch()
    const body = await response.text()
    expect(body).toContain('const mockTransport = createMockTransport();')
    await route.fulfill({
      response,
      body: body.replace(
        'const mockTransport = createMockTransport();',
        'const mockTransport = createMockTransport({ cardsFirst: true, textDelayMs: 3000 });',
      ),
    })
  })
  await freshChat(page)
  await page.getByRole('textbox').fill('Give me a palette for teal')
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  const chat = page.locator('section').filter({ has: page.locator('#chat-input') })
  const status = chat.getByRole('status')
  await expect(status).toHaveText('Your results are ready. Muse is writing the guidance…')
  await expect(chat.locator('[data-card-type="palette"]').first()).toBeVisible()
  await expect(chat.getByRole('status')).toHaveCount(1)
  await expect(status).toHaveText('Writing a reply…')
})

test('all three welcome suggestions fit without scrolling at 390 by 844', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await freshChat(page)
  const thread = page.getByRole('region', { name: 'Messages' })
  for (const mode of ['Find ideas', 'Mix colours', 'Improve composition', 'Explore art']) {
    await page.getByRole('radio', { name: mode }).click()
    const suggestions = page.getByRole('group', { name: 'Suggested prompts' }).getByRole('button')
    await expect(suggestions).toHaveCount(3)
    await thread.evaluate((node) => {
      node.scrollTop = 0
    })
    const frame = await thread.boundingBox()
    for (const suggestion of await suggestions.all()) {
      const box = await suggestion.boundingBox()
      expect(box!.y).toBeGreaterThanOrEqual(frame!.y)
      expect(box!.y + box!.height).toBeLessThanOrEqual(frame!.y + frame!.height)
    }
  }
})

async function prepareTallComposer(page: Page) {
  await page.locator('#chat-input').evaluate(async (input) => {
    const canvas = document.createElement('canvas')
    canvas.width = 100
    canvas.height = 80
    const context = canvas.getContext('2d')!
    context.fillStyle = '#778899'
    context.fillRect(0, 0, 100, 80)
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((blob) => resolve(blob!), 'image/jpeg'))
    const data = new DataTransfer()
    for (let index = 0; index < 3; index++) data.items.add(new File([blob], `synthetic-${index}.jpg`, { type: 'image/jpeg' }))
    input.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
  })
  await expect(page.getByRole('button', { name: 'Remove image' })).toHaveCount(3)
  await page.getByRole('textbox').fill('Draw three shapes on a page.\n'.repeat(30))
}

test('long desktop history stays inside the frame and leaves reply versions clickable', async ({ page }) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
  ]) {
    await page.setViewportSize(viewport)
    await freshChat(page)
    await seedChatCards(page)
    await page.evaluate(() => {
      const stored = JSON.parse(localStorage.getItem('artspark:chat')!)
      const current = stored.state.conversations[0]
      stored.state.conversations = Array.from({ length: 13 }, (_, index) => ({
        ...current,
        id: index ? `history-${index}` : current.id,
        title: `Afternoon drawing study and colour choices to remember ${index + 1}`,
        updatedAt: new Date(Date.now() - index * 86400000).toISOString(),
      }))
      localStorage.setItem('artspark:chat', JSON.stringify(stored))
    })
    await page.reload()
    await page.evaluate(() => window.scrollTo(0, 0))
    const chat = page.locator('section').filter({ has: page.locator('#chat-input') })
    const bottom = await chat.evaluate((node) => node.getBoundingClientRect().bottom)
    const footerTop = await page.locator('footer').evaluate((node) => node.getBoundingClientRect().top)
    expect(bottom).toBeLessThanOrEqual(Math.min(footerTop, viewport.height))
    const history = page.getByRole('complementary', { name: 'Conversations' })
    const last = history.getByRole('button', { name: /remember 13/ })
    const list = history.locator('ul').first()
    await list.evaluate((node) => {
      node.scrollTop = 0
    })
    await last.focus()
    const bounds = await last.boundingBox()
    const listBounds = await list.boundingBox()
    expect(bounds!.y).toBeGreaterThanOrEqual(listBounds!.y)
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(listBounds!.y + listBounds!.height + 1)
    await list.evaluate((node) => {
      node.scrollTop = node.scrollHeight
    })
    await expect(last).toBeInViewport()
    await expect(history.getByRole('button', { name: 'New conversation' })).toBeInViewport()
    const previous = page.getByRole('button', { name: 'Previous version' })
    const next = page.getByRole('button', { name: 'Next version' })
    for (const button of [previous, next]) {
      expect(
        await button.evaluate((node) => {
          const box = node.getBoundingClientRect()
          return node.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2))
        }),
      ).toBe(true)
    }
    await previous.click()
    await expect(chat).toContainText('Draw two shapes.')
    await next.click()
    await expect(chat).toContainText('Try drawing three simple shapes.')
  }
})

for (const { width, height, packed } of [
  { width: 360, height: 430, packed: true },
  { width: 390, height: 667, packed: true },
  { width: 390, height: 844, packed: false },
]) {
  test(`composer stays reachable at ${width}x${height} ${packed ? 'with images and a tall draft' : 'when empty'}`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await freshChat(page)
    if (packed) await prepareTallComposer(page)
    if (height === 430) {
      await page.getByRole('textbox').focus()
      await page.locator('#chat-input').evaluate((input) => input.closest('form')!.parentElement!.scrollIntoView({ block: 'end' }))
    } else {
      await page.evaluate(() => window.scrollTo(0, 0))
      expect(await page.evaluate(() => window.scrollY)).toBe(0)
    }
    await expect
      .poll(() =>
        page.locator('#chat-input').evaluate((input) => {
          const composer = input.closest('form')!.parentElement!
          return [...composer.querySelectorAll('button, textarea, summary')]
            .filter((node) => node.getClientRects().length)
            .flatMap((node) => {
              const box = node.getBoundingClientRect()
              const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
              return box.top < 0 || box.bottom > innerHeight || !(hit === node || node.contains(hit))
                ? [{ name: node.getAttribute('aria-label') || node.tagName, top: box.top, bottom: box.bottom, hit: hit?.tagName }]
                : []
            })
        }),
      )
      .toEqual([])
    if (height >= 568) expect(await page.evaluate(() => window.scrollY)).toBe(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect(await page.locator('#chat-input').evaluate((input) => parseFloat(getComputedStyle(input).fontSize))).toBeGreaterThanOrEqual(16)
  })
}
