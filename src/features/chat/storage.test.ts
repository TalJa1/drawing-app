import type { ChatMessage, Conversation } from '@/types'
import { useChat } from '@/store/chat'
import { STORE_KEYS } from '@/store/storage'
import { migrateChatState, reviveInterrupted } from './storage'
import { cleanupOrphanChatImages } from './chatImages'

vi.mock('./chatImages', () => ({ cleanupOrphanChatImages: vi.fn(), deleteConversationImages: vi.fn() }))

const date = '2026-10-27T00:00:00.000Z'
const reply = (id: string): ChatMessage => ({
  id,
  turnId: `t_${id}`,
  role: 'assistant',
  content: id,
  cards: [],
  attachments: [],
  createdAt: date,
  status: 'completed',
})
const conversation = (messages: ChatMessage[]): Conversation => ({
  id: 'c_1',
  title: 'My drawing',
  mode: 'colour',
  messages,
  createdAt: date,
  updatedAt: date,
})

beforeEach(() => {
  useChat.getState().reset()
  vi.clearAllMocks()
})

it('migrates v1: pairs turnIds, maps error→failed, keeps text/cards/rating/attachments', () => {
  const cards = [{ type: 'palette', name: 'Old palette', colors: ['#8A8A8A', '#8a8a8a', '#eeeeee'] }]
  const user = {
    id: 'm_user',
    role: 'user',
    content: 'My painting',
    cards: [],
    attachments: [{ kind: 'image', src: 'data:image/png;base64,old', name: 'art.png' }],
    createdAt: date,
  }
  const assistant = {
    id: 'm_reply',
    role: 'assistant',
    content: 'Try shadows',
    cards,
    attachments: [],
    createdAt: date,
    pending: true,
    error: true,
    rating: 'up',
  }
  const result = migrateChatState(
    {
      conversations: [{ ...conversation([]), messages: [user, assistant, { ...assistant, id: 'm_ok', error: false }] }],
      activeId: 'c_1',
      draft: 'From Free Draw',
    },
    1,
  )
  const [u, a, ok] = result.conversations[0].messages
  expect(u.turnId).toMatch(/^t_/)
  expect(u.mode).toBe('colour')
  expect(a.turnId).toBe(u.turnId)
  expect(a).toMatchObject({ content: assistant.content, cards, rating: 'up', status: 'failed' })
  expect(ok.status).toBe('completed')
  expect(a).not.toHaveProperty('pending')
  expect(a).not.toHaveProperty('error')
  expect(u.attachments[0]).toMatchObject({ ...user.attachments[0], id: expect.stringMatching(/^a_/) })
  expect(result).toMatchObject({ activeId: 'c_1', draft: 'From Free Draw', drafts: {}, conversations: [{ title: 'My drawing' }] })
})

it('marks persisted streaming replies as interrupted on load', async () => {
  const messages = [{ ...reply('m_1'), status: 'streaming' as const, content: 'checkpoint text' }]
  const original = [conversation(messages)]
  expect(reviveInterrupted(original)[0].messages[0]).toMatchObject({ status: 'interrupted', content: 'checkpoint text' })
  expect(original[0].messages[0].status).toBe('streaming')
  localStorage.setItem(
    STORE_KEYS.chat,
    JSON.stringify({ version: 2, state: { conversations: original, activeId: 'c_1', draft: null, drafts: {} } }),
  )
  await useChat.persist.rehydrate()
  expect(useChat.getState().conversations[0].messages[0]).toMatchObject({ status: 'interrupted', content: 'checkpoint text' })
})

it('migrating v2 input is a no-op', () => {
  const state = { conversations: [conversation([reply('m_1')])], activeId: 'c_1', draft: null, drafts: { c_1: 'unfinished' } }
  expect(migrateChatState(state, 2)).toEqual(state)
})

it('corrupt input yields empty state without throwing', () => {
  for (const value of [undefined, null, 'invalid', {}, { conversations: 'wrong' }, { conversations: [{ messages: [null] }] }]) {
    expect(migrateChatState(value, 1)).toEqual({ conversations: [], activeId: null, draft: null, drafts: {} })
    expect(migrateChatState(value, 2)).toEqual({ conversations: [], activeId: null, draft: null, drafts: {} })
  }
})

it('drops malformed cards and variants but keeps the conversation', () => {
  const card = { type: 'lesson', slug: 'old-lesson' }
  const variant = { content: 'saved answer', cards: [card], status: 'completed', createdAt: date }
  const state = {
    conversations: [
      conversation([
        {
          ...reply('m_1'),
          cards: [null, card, { type: 'palette', colors: null }],
          variants: [{ content: 'broken' }, variant, { ...variant, cards: [null, card] }],
          attachments: [null, { kind: 'image', id: 'a_1', name: 'art.jpg', blobKey: 'chat:a_1:full' }],
        } as unknown as ChatMessage,
      ]),
    ],
    activeId: 'c_1',
    draft: 'keep draft',
    drafts: { c_1: 'unfinished' },
  }
  const result = migrateChatState(state, 2)
  expect(result).toMatchObject({ activeId: 'c_1', draft: 'keep draft', drafts: { c_1: 'unfinished' } })
  expect(result.conversations[0].messages[0]).toMatchObject({
    cards: [card],
    variants: [variant, variant],
    attachments: [{ id: 'a_1', blobKey: 'chat:a_1:full' }],
    content: 'm_1',
  })
})

it('repairs v2 messages missing a turnId or attachment id instead of wiping the store', () => {
  const user = {
    ...reply('user'),
    role: 'user',
    turnId: undefined,
    attachments: [{ kind: 'image', name: 'old.png', src: 'data:image/png;base64,old' }],
  }
  const state = {
    conversations: [conversation([user as unknown as ChatMessage, { ...reply('assistant'), turnId: undefined } as unknown as ChatMessage])],
    activeId: 'c_1',
    draft: null,
    drafts: {},
  }
  const [u, a] = migrateChatState(state, 2).conversations[0].messages
  expect(u.turnId).toMatch(/^t_/)
  expect(a.turnId).toBe(u.turnId)
  expect(u.attachments[0]).toMatchObject({ id: expect.stringMatching(/^a_/), src: 'data:image/png;base64,old' })
})

it('drops only the message or conversation that cannot be read', () => {
  const state = {
    conversations: [
      null,
      { ...conversation([]), id: 42 },
      { ...conversation([]), messages: [reply('valid'), null, { ...reply('bad'), content: null }] },
    ],
    activeId: 'c_1',
    draft: null,
    drafts: {},
  }
  expect(migrateChatState(state, 2).conversations).toEqual([conversation([reply('valid')])])
})

it('keeps readable history when optional stored metadata is malformed', async () => {
  for (const patch of [{ rating: 42 }, { status: 'unknown' }, { mode: null }, { pending: 'wrong' }, { error: 'wrong' }, { turnId: 42 }]) {
    const state = {
      conversations: [{ ...conversation([reply('valid')]), messages: [{ ...reply('valid'), ...patch }] }],
      activeId: 'c_1',
      draft: null,
      drafts: {},
    }
    const result = migrateChatState(state, 2)
    expect(result.conversations[0].messages).toHaveLength(1)
    expect(result.conversations[0].messages[0].content).toBe('valid')
    expect(result.conversations[0].messages[0].turnId).toMatch(/^t_/)
    localStorage.setItem(STORE_KEYS.chat, JSON.stringify({ version: 2, state }))
    await useChat.persist.rehydrate()
    expect(cleanupOrphanChatImages).not.toHaveBeenCalled()
  }
  const result = migrateChatState(
    { conversations: [{ ...conversation([reply('valid')]), imageContextTurnId: 42 }], activeId: 'c_1', draft: null, drafts: {} },
    2,
  )
  expect(result.conversations[0].messages[0].content).toBe('valid')
})

it('skips orphan image cleanup when stored chat data had to be repaired', async () => {
  for (const version of [1, 2]) {
    for (const patch of [{ cards: [null] }, { turnId: undefined }, { attachments: [{ kind: 'image', name: 'old.jpg' }] }]) {
      localStorage.setItem(
        STORE_KEYS.chat,
        JSON.stringify({
          version,
          state: {
            conversations: [conversation([{ ...reply('m_1'), ...patch } as ChatMessage])],
            activeId: 'c_1',
            draft: null,
            drafts: {},
          },
        }),
      )
      await useChat.persist.rehydrate()
      expect(cleanupOrphanChatImages).not.toHaveBeenCalled()
      expect(useChat.getState().conversations).toHaveLength(1)
    }
  }
  localStorage.removeItem(STORE_KEYS.chat)
  await useChat.persist.rehydrate()
  expect(cleanupOrphanChatImages).toHaveBeenCalledTimes(1)
  vi.mocked(cleanupOrphanChatImages).mockClear()
  localStorage.setItem(
    STORE_KEYS.chat,
    JSON.stringify({
      version: 2,
      state: {
        conversations: [conversation([reply('valid')])],
        activeId: 'c_1',
        draft: null,
        drafts: {},
      },
    }),
  )
  await useChat.persist.rehydrate()
  expect(cleanupOrphanChatImages).toHaveBeenCalledWith([conversation([reply('valid')])])
})

it('selectVariant ignores replies that are not last', () => {
  useChat.setState({ conversations: [conversation([reply('old'), reply('last')])] })
  const store = useChat.getState()
  store.pushVariant('c_1', 'old')
  store.selectVariant('c_1', 'old', 0)
  expect(useChat.getState().conversations[0].messages[0]).toEqual(reply('old'))
  store.pushVariant('c_1', 'last')
  store.commitReply('c_1', 'last', { content: 'new answer' })
  store.selectVariant('c_1', 'last', 0)
  const last = useChat.getState().conversations[0].messages[1]
  expect(last.content).toBe('last')
  expect(last.variants?.[0].content).toBe('new answer')
})

it('drafts are kept per conversation and cleared by reset', () => {
  const store = useChat.getState()
  store.setConversationDraft('c_1', 'one')
  store.setConversationDraft('c_2', 'two')
  store.setConversationDraft('__new__', 'new conversation')
  store.setConversationDraft('c_1', '')
  expect(useChat.getState().drafts).toEqual({ c_2: 'two', __new__: 'new conversation' })
  store.reset()
  expect(useChat.getState().drafts).toEqual({})
})

it('setDraft and reset keep working for other pages', () => {
  const store = useChat.getState()
  store.setDraft('Help me with this drawing')
  expect(useChat.getState().draft).toBe('Help me with this drawing')
  store.setDraft(null)
  expect(useChat.getState().draft).toBeNull()
  store.create('ideas')
  store.reset()
  expect(useChat.getState()).toMatchObject({ conversations: [], activeId: null, draft: null })
})
