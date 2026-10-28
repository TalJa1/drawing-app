import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { useLocation } from 'react-router-dom'
import { ChatCardView } from './ChatCards'
import { installDomStubs, renderChat } from './test-utils'
import { TEMPLATE_MAP } from '@/mocks/templates'
import { LESSON_MAP } from '@/mocks/lessons'
import { useStudio } from '@/store/studio'
import { copyText } from '@/lib/utils'
import { recordActivity } from '@/api/progress'

vi.mock('@/features/gamification/hooks', () => ({ useLevel: () => ({ level: 1 }) }))
vi.mock('@/api/progress', () => ({ recordActivity: vi.fn(async () => null) }))
vi.mock('@/lib/utils', async (original) => ({ ...(await original<object>()), copyText: vi.fn(async () => true) }))

const palette = { type: 'palette', name: 'Forest', colors: ['#112233', '#445566', '#778899'] } as const
const paletteCard = { ...palette, colors: [...palette.colors] }
function Location() {
  return <output>{useLocation().pathname}</output>
}

beforeEach(() => {
  installDomStubs()
  vi.mocked(recordActivity).mockClear()
  useStudio.getState().setPendingPalette(null)
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
