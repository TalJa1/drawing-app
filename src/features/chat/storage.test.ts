import type { ChatMessage, Conversation } from '@/types'
import { useChat } from '@/store/chat'
import { STORE_KEYS } from '@/store/storage'
import { migrateChatState, reviveInterrupted } from './storage'

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

beforeEach(() => useChat.getState().reset())

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

it('corrupt persisted cards and variants yield empty state', () => {
  const empty = { conversations: [], activeId: null, draft: null, drafts: {} }
  for (const patch of [
    { cards: [null] },
    { cards: [{ type: 'palette', name: 'broken', colors: null }] },
    { variants: [{ content: 'broken' }] },
  ]) {
    const state = {
      conversations: [conversation([{ ...reply('m_1'), ...patch } as ChatMessage])],
      activeId: 'c_1',
      draft: null,
      drafts: {},
    }
    expect(migrateChatState(state, 2)).toEqual(empty)
  }
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
