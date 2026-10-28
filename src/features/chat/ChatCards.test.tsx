import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { useLocation } from 'react-router-dom'
import { ChatCardView } from './ChatCards'
import { installDomStubs, renderChat } from './test-utils'
import { TEMPLATE_MAP } from '@/mocks/templates'
import { LESSON_MAP } from '@/mocks/lessons'
import { useStudio } from '@/store/studio'
import { copyText } from '@/lib/utils'
import { recordActivity } from '@/api/progress'
import { useChat } from '@/store/chat'

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
