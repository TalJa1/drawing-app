import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { copyText } from '@/lib/utils'
import { useToasts } from '@/store/ui'
import { MessageActions } from './MessageActions'
import { installDomStubs, renderChat } from '../test-utils'

vi.mock('@/lib/utils', async (original) => ({ ...(await original<object>()), copyText: vi.fn() }))

beforeEach(() => {
  installDomStubs()
  useToasts.setState({ toasts: [] })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('copy failure shows an error toast', async () => {
  vi.mocked(copyText).mockResolvedValue(false)
  await renderChat(
    <MessageActions
      conversationId="c_1"
      last={false}
      message={{
        id: 'm_1',
        turnId: 't_1',
        role: 'assistant',
        content: 'Draw a tree',
        cards: [],
        attachments: [],
        createdAt: '2026-10-28T00:00:00Z',
        status: 'completed',
      }}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
  await waitFor(() => expect(useToasts.getState().toasts).toHaveLength(1))
  expect(useToasts.getState().toasts[0]).toMatchObject({ tone: 'error' })
})

it('copying a card-only reply copies the card details', async () => {
  vi.mocked(copyText).mockResolvedValue(true)
  await renderChat(
    <MessageActions
      conversationId="c_1"
      last={false}
      message={{
        id: 'm_1',
        turnId: 't_1',
        role: 'assistant',
        content: '',
        cards: [{ type: 'palette', name: 'Dusk', colors: ['#112233', '#445566', '#778899'] }],
        attachments: [],
        createdAt: '2026-10-28T00:00:00Z',
        status: 'interrupted',
      }}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
  await waitFor(() => expect(useToasts.getState().toasts).toHaveLength(1))
  expect(vi.mocked(copyText).mock.calls.at(-1)?.[0]).toBe('Dusk\n#112233\n#445566\n#778899')
})
