import type { ChatAttachment, ChatMessage, Conversation } from '@/types'
import { useLearn } from '@/store/learn'
import { useProgress } from '@/store/progress'
import { levelFromXp } from '@/features/gamification/rules'
import { buildTurnRequest } from './request'
import { learnerSnapshot } from './useMuse'
import { loadChatImage } from './chatImages'
import { chatTurnRequestSchema } from './contract'

vi.mock('./chatImages', () => ({ loadChatImage: vi.fn() }))

const message = (role: 'user' | 'assistant', turnId: string, content = 'Drawing', values: Partial<ChatMessage> = {}): ChatMessage => ({
  id: `${turnId}-${role}`,
  turnId,
  role,
  content,
  cards: [],
  attachments: [],
  status: 'completed',
  createdAt: '2026-10-27T00:00:00Z',
  ...values,
})
const photo = (id = 'image-1'): ChatAttachment => ({
  kind: 'image',
  id,
  name: 'Drawing.jpg',
  blobKey: `chat:${id}:full`,
  width: 8,
  height: 6,
  hash: 'test-hash',
})
const conversation = (messages: ChatMessage[], values: Partial<Conversation> = {}): Conversation => ({
  id: 'conversation-1',
  title: 'Drawing',
  mode: 'ideas',
  createdAt: '2026-10-27T00:00:00Z',
  updatedAt: '2026-10-27T00:00:00Z',
  messages,
  ...values,
})
const build = (conv: Conversation, action: 'send' | 'regenerate' = 'send') => buildTurnRequest(conv, 'current', action, null)

beforeEach(() => {
  vi.mocked(loadChatImage).mockReset()
  vi.mocked(loadChatImage).mockResolvedValue(new Blob([new Uint8Array([255, 216, 255, 0])], { type: 'image/jpeg' }))
})
afterEach(() => {
  useLearn.getState().reset()
  useProgress.getState().reset()
})

it('request: excludes failed replies', async () => {
  const req = await build(
    conversation([message('user', 'old'), message('assistant', 'old', 'Failed text', { status: 'failed' }), message('user', 'current')]),
  )
  expect(req.history).toEqual([{ role: 'user', text: 'Drawing' }])
})

it('request: regenerate excludes the reply being replaced', async () => {
  const req = await build(conversation([message('user', 'current'), message('assistant', 'current', 'Replace me')]), 'regenerate')
  expect(req.history).toEqual([])
  expect(req.action).toBe('regenerate')
})

it('request: trims oldest whole turns to 24 items and 60 000 chars', async () => {
  const messages = Array.from({ length: 16 }, (_, i) => [
    message('user', `t-${i}`, `${i}:` + 'x'.repeat(3990)),
    message('assistant', `t-${i}`, 'y'.repeat(3990)),
  ]).flat()
  const req = await build(conversation([...messages, message('user', 'current')]))
  expect(req.history).toHaveLength(14)
  expect(req.history[0].text).toMatch(/^9:/)
  expect(req.history.at(-1)?.role).toBe('assistant')
  expect(req.history.reduce((sum, item) => sum + item.text.length, 0)).toBeLessThanOrEqual(60_000)
})

it('request: sends images of one turn only, at most 3', async () => {
  const req = await build(
    conversation([
      message('user', 'old', 'Old', { attachments: [photo('old')] }),
      message('user', 'current', 'New', { attachments: [photo('a'), photo('b'), photo('c'), photo('d')] }),
    ]),
  )
  expect(req.message.images.map((i) => i.id)).toEqual(['a', 'b', 'c'])
  expect(req.history.flatMap((i) => i.images ?? [])).toEqual([])
  expect(loadChatImage).toHaveBeenCalledTimes(3)
  expect(chatTurnRequestSchema.safeParse(req).success).toBe(true)
})

it('request: a cleared image context sends no earlier images', async () => {
  const req = await build(
    conversation([message('user', 'old', 'Old', { attachments: [photo()] }), message('user', 'current')], { imageContextTurnId: null }),
  )
  expect(req.message.images).toEqual([])
  expect(req.history.flatMap((i) => i.images ?? [])).toEqual([])
  expect(loadChatImage).not.toHaveBeenCalled()
})

it('request: flags missing blobs instead of sending empty images', async () => {
  vi.mocked(loadChatImage).mockResolvedValue(undefined)
  const req = await build(
    conversation([message('user', 'old', 'Old', { attachments: [photo()] }), message('user', 'current')], { imageContextTurnId: 'old' }),
  )
  expect(req.history[0].imageMissing).toBe(true)
  expect(req.history[0].images ?? []).toEqual([])
})

it('request: legacy preview-only attachments are flagged missing', async () => {
  const req = await build(
    conversation([
      message('user', 'old', 'Old', { attachments: [{ kind: 'image', id: 'legacy', name: 'Old', src: 'data:image/jpeg;base64,AAAA' }] }),
      message('user', 'current'),
    ]),
  )
  expect(req.history[0].imageMissing).toBe(true)
  expect(loadChatImage).not.toHaveBeenCalled()
})

it('request: skips empty stopped or interrupted replies', async () => {
  const req = await build(
    conversation([
      message('user', 'one'),
      message('assistant', 'one', '', { status: 'stopped' }),
      message('user', 'two'),
      message('assistant', 'two', '   ', { status: 'interrupted' }),
      message('user', 'current'),
    ]),
  )
  expect(req.history.map((i) => i.role)).toEqual(['user', 'user'])
})

it('request: includes validated cards even when the reply contains no text', async () => {
  const card = { type: 'palette', name: 'Forest', colors: ['#003300', '#336633', '#99cc99'] } as const
  const req = await build(
    conversation([
      message('user', 'old'),
      message('assistant', 'old', '', { cards: [{ ...card, colors: [...card.colors] }], status: 'stopped' }),
      message('user', 'current'),
    ]),
  )
  expect(req.history[1]).toEqual({ role: 'assistant', text: '', cards: [card], status: 'stopped' })
})

it('request: follows the selected image turn and falls back to the nearest stored image', async () => {
  const messages = [
    message('user', 'first', 'First', { attachments: [photo('first')] }),
    message('user', 'second', 'Second', { attachments: [photo('second')] }),
    message('user', 'current'),
  ]
  const selected = await build(conversation(messages, { imageContextTurnId: 'first' }))
  expect(selected.history[0].images?.[0].id).toBe('first')
  const legacy = await build(conversation(messages))
  expect(legacy.history[1].images?.[0].id).toBe('second')
})

it('request: reads the current learner level and completed lesson slugs', () => {
  useProgress.setState({ xp: 500 })
  useLearn.getState().setLessonProgress('rule-of-thirds', { completed: true })
  useLearn.getState().setLessonProgress('unfinished', { completed: false })
  expect(learnerSnapshot()).toEqual({ level: levelFromXp(500), completedLessons: ['rule-of-thirds'] })
})
