import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { useLocation } from 'react-router-dom'
import { ChatCardView } from './ChatCards'
import { installDomStubs, renderChat } from './test-utils'
import { TEMPLATE_MAP } from '@/mocks/templates'
import { LESSON_MAP } from '@/mocks/lessons'
import { useStudio } from '@/store/studio'
import { copyText } from '@/lib/utils'
import { recordActivity } from '@/api/progress'
import { useChat } from '@/store/chat'
import { contrastRatio } from '@/lib/color'

vi.mock('@/features/gamification/hooks', () => ({ useLevel: () => ({ level: 1 }) }))
vi.mock('@/api/progress', () => ({ recordActivity: vi.fn(async () => null) }))
vi.mock('@/lib/utils', async (original) => ({ ...(await original<object>()), copyText: vi.fn(async () => true) }))

const palette = { type: 'palette', name: 'Forest', colors: ['#112233', '#445566', '#778899'] } as const
const paletteCard = { ...palette, colors: [...palette.colors] }
function Location() {
  return <output>{useLocation().pathname}</output>
}

beforeEach(() => {
  useChat.getState().reset()
  installDomStubs()
  vi.mocked(recordActivity).mockClear()
  useStudio.getState().setPendingPalette(null)
})

const critique = {
  type: 'critique' as const,
  imageId: 'a_old',
  observations: ['A tree against a pale sky'],
  strengths: ['Clear silhouette'],
  priorities: ['Deepen the sky'],
  exercise: 'Draw three value thumbnails',
}

it('critique card renders observations, priorities and exercise', async () => {
  await renderChat(<ChatCardView card={critique} />)
  for (const text of [...critique.observations, ...critique.strengths, ...critique.priorities, critique.exercise])
    expect(screen.getByText(text)).toBeInTheDocument()
  expect(screen.getByText('Image feedback · Suggested by Muse')).toBeInTheDocument()
  expect(screen.getByText('Suggestions based on this image. Check against your drawing.')).toBeInTheDocument()
  expect(screen.getByText('This image is no longer available. Attach it again.')).toBeInTheDocument()
})

it('critique shows the filename and preview belonging to imageId, including older turns', async () => {
  const id = useChat.getState().create()
  for (const turn of ['old', 'new'])
    useChat.getState().addMessage(id, {
      id: `user_${turn}`,
      turnId: turn,
      role: 'user',
      content: 'Drawing',
      cards: [],
      attachments: [{ kind: 'image', id: `a_${turn}`, name: `${turn}.jpg`, src: `data:image/jpeg;base64,${turn}` }],
      createdAt: '2026-10-30T00:00:00Z',
    })
  await renderChat(<ChatCardView card={critique} conversationId={id} />)
  expect(screen.getByRole('img', { name: 'old.jpg' })).toHaveAttribute('src', 'data:image/jpeg;base64,old')
  expect(screen.getByText('old.jpg')).toBeInTheDocument()
  expect(screen.queryByRole('img', { name: 'new.jpg' })).not.toBeInTheDocument()
})

it('all five card types identify their source', async () => {
  const template = Object.values(TEMPLATE_MAP).find((item) => item.unlockLevel === 1)!
  const lesson = Object.values(LESSON_MAP)[0]
  await renderChat(
    <>
      <ChatCardView card={paletteCard} />
      <ChatCardView card={{ type: 'idea', title: 'Tree', description: 'Draw a tree', difficulty: 'beginner', minutes: 10 }} />
      <ChatCardView card={critique} />
      <ChatCardView card={{ type: 'template', templateId: template.id }} />
      <ChatCardView card={{ type: 'lesson', slug: lesson.slug }} />
    </>,
  )
  for (const label of [
    'Palette · Suggested by Muse',
    'Idea · Suggested by Muse',
    'Image feedback · Suggested by Muse',
    'Template · Art Spark library',
    'Lesson · Art Spark library',
  ])
    expect(screen.getByText(label)).toBeInTheDocument()
})

it('critique follow-up selects its own image and focuses the composer', async () => {
  const id = useChat.getState().create()
  for (const turnId of ['old', 'new'])
    useChat.getState().addMessage(id, {
      id: `u_${turnId}`,
      turnId,
      role: 'user',
      content: 'Image',
      cards: [],
      attachments: [{ kind: 'image', id: `a_${turnId}`, name: `${turnId}.jpg`, blobKey: `chat:a_${turnId}:full` }],
      createdAt: '2026-10-28T00:00:00Z',
    })
  useChat.getState().setImageContext(id, 'new')
  await renderChat(
    <>
      <ChatCardView card={critique} />
      <textarea id="chat-input" />
    </>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Ask about this image' }))
  expect(useChat.getState().conversations[0].imageContextTurnId).toBe('old')
  expect(screen.getByRole('textbox')).toHaveFocus()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it('template card above learner level shows lock and no link', async () => {
  const template = Object.values(TEMPLATE_MAP).find((item) => item.unlockLevel > 1)!
  await renderChat(<ChatCardView card={{ type: 'template', templateId: template.id, reason: 'Practise edges' }} />)
  expect(screen.getByText(`Unlocks at level ${template.unlockLevel}`)).toBeInTheDocument()
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
  expect(screen.getByText('Practise edges')).toBeInTheDocument()
})

it('unknown lesson slug renders nothing', async () => {
  const page = await renderChat(<ChatCardView card={{ type: 'lesson', slug: 'not-a-real-lesson' }} />)
  expect(page.container).toBeEmptyDOMElement()
})

it('palette send sets the pending palette and navigates to /free-draw', async () => {
  await renderChat(
    <>
      <ChatCardView card={paletteCard} />
      <Location />
    </>,
  )
  fireEvent.click(screen.getByRole('button', { name: /send palette to studio/i }))
  await waitFor(() => expect(screen.getByText('/free-draw')).toBeInTheDocument())
  expect(useStudio.getState().pendingPalette).toEqual({ name: palette.name, colors: palette.colors })
  expect(recordActivity).toHaveBeenCalledExactlyOnceWith({ type: 'paletteSent' })
})

it('palette shows roles and note', async () => {
  await renderChat(<ChatCardView card={{ ...paletteCard, roles: ['dominant', 'support', 'accent'], note: 'Keep the accent small' }} />)
  for (const label of ['Dominant', 'Support', 'Accent', 'Keep the accent small']) expect(screen.getByText(label)).toBeInTheDocument()
})

it('HEX labels keep AA contrast even for mid-tone swatches', async () => {
  const colors = ['#000000', '#FFFFFF', '#777777', '#888888', '#FF0000', '#00AA88']
  await renderChat(<ChatCardView card={{ type: 'palette', name: 'Contrast', colors }} />)
  for (const color of colors) {
    const label = screen.getByText(color)
    const button = label.closest('button')!
    const toHex = (value: string) =>
      `#${value
        .match(/\d+/g)!
        .slice(0, 3)
        .map((number) => Number(number).toString(16).padStart(2, '0'))
        .join('')}`
    const background = label.style.background ? toHex(label.style.background) : color
    expect(contrastRatio(toHex(button.style.color), background)).toBeGreaterThanOrEqual(4.5)
  }
})

it('copying a swatch confirms locally and resets the check', async () => {
  await renderChat(<ChatCardView card={paletteCard} />)
  vi.useFakeTimers()
  const swatch = screen.getByRole('button', { name: /#112233/i })
  await act(async () => fireEvent.click(swatch))
  expect(copyText).toHaveBeenCalledWith('#112233')
  expect(swatch.querySelector('.lucide-check')).toBeInTheDocument()
  await act(async () => vi.advanceTimersByTimeAsync(1200))
  expect(swatch.querySelector('.lucide-check')).not.toBeInTheDocument()
})

it('copying the same swatch again restarts the confirmation timeout', async () => {
  await renderChat(<ChatCardView card={paletteCard} />)
  vi.useFakeTimers()
  const swatch = screen.getByRole('button', { name: /#112233/i })
  await act(async () => fireEvent.click(swatch))
  await act(async () => vi.advanceTimersByTimeAsync(900))
  await act(async () => fireEvent.click(swatch))
  await act(async () => vi.advanceTimersByTimeAsync(300))
  expect(swatch.querySelector('.lucide-check')).toBeInTheDocument()
  await act(async () => vi.advanceTimersByTimeAsync(899))
  expect(swatch.querySelector('.lucide-check')).toBeInTheDocument()
  await act(async () => vi.advanceTimersByTimeAsync(1))
  expect(swatch.querySelector('.lucide-check')).not.toBeInTheDocument()
})

it('lesson shows difficulty, minutes and reason with a catalog route', async () => {
  const lesson = Object.values(LESSON_MAP)[0]
  await renderChat(<ChatCardView card={{ type: 'lesson', slug: lesson.slug, reason: 'Practise value' }} />)
  expect(screen.getByRole('link')).toHaveAttribute('href', `/learn/lessons/${lesson.slug}`)
  expect(screen.getByText('Practise value')).toBeInTheDocument()
  expect(screen.getByText(new RegExp(lesson.difficulty, 'i'))).toBeInTheDocument()
  expect(screen.getByText(new RegExp(`${lesson.minutes} min`))).toBeInTheDocument()
})

it('unlocked templates keep their local practice route', async () => {
  const template = Object.values(TEMPLATE_MAP).find((item) => item.unlockLevel === 1)!
  await renderChat(<ChatCardView card={{ type: 'template', templateId: template.id }} />)
  expect(screen.getByRole('link')).toHaveAttribute('href', `/practice/${template.id}`)
})

it('six-colour palettes keep balanced rows and each swatch carries its own role', async () => {
  const colors = ['#112233', '#445566', '#778899', '#AA3311', '#EEDD22', '#FFFFFF']
  const roles = ['dominant', 'support', 'support', 'accent', 'support', 'accent'] as const
  await renderChat(<ChatCardView card={{ type: 'palette', name: 'Six', colors, roles: [...roles] }} />)
  const swatches = colors.map((hex) => screen.getByRole('button', { name: new RegExp(hex, 'i') }))
  expect(swatches.map((swatch) => swatch.style.gridColumn)).toEqual(Array(6).fill('span 4 / span 4'))
  swatches.forEach((swatch, index) => expect(within(swatch).getByText(new RegExp(`^${roles[index]}$`, 'i'))).toBeInTheDocument())
  expect(swatches[5]).toHaveAccessibleName('Copy colour #FFFFFF, Accent')
})

it('five-colour palettes split into rows of three and two without one stretched swatch', async () => {
  const colors = ['#112233', '#445566', '#778899', '#AA3311', '#EEDD22']
  await renderChat(<ChatCardView card={{ type: 'palette', name: 'Five', colors }} />)
  expect(colors.map((hex) => screen.getByRole('button', { name: new RegExp(hex, 'i') }).style.gridColumn)).toEqual([
    'span 4 / span 4',
    'span 4 / span 4',
    'span 4 / span 4',
    'span 6 / span 6',
    'span 6 / span 6',
  ])
})
