import { chatCardSchema } from './contract'
import { chatTurnRequestSchema } from './requestSchema'

const request = () => ({
  protocolVersion: 1,
  requestId: 'r_1',
  conversationId: 'c_1',
  turnId: 't_1',
  action: 'send',
  mode: 'ideas',
  lang: 'vi',
  message: { text: '', images: [] },
  history: [],
  learner: null,
})

it.each([200, 201])('matches the backend completed lesson limit for %i slugs', (count) => {
  const learner = { level: 1, completedLessons: Array.from({ length: count }, (_, i) => `lesson-${i}`) }
  expect(chatTurnRequestSchema.safeParse({ ...request(), learner }).success).toBe(count <= 200)
})

it.each([6, 7])('matches the backend history card limit for %i cards', (count) => {
  const cards = Array.from({ length: count }, () => ({ type: 'lesson', slug: 'rule-of-thirds' }))
  expect(chatTurnRequestSchema.safeParse({ ...request(), history: [{ role: 'assistant', text: '', cards }] }).success).toBe(count <= 6)
})

it('applies the history card limit before dropping invalid old cards', () => {
  const cards = Array.from({ length: 7 }, () => ({ type: 'unknown' }))
  expect(chatTurnRequestSchema.safeParse({ ...request(), history: [{ role: 'assistant', text: '', cards }] }).success).toBe(false)
})

it.each([
  { protocolVersion: true },
  { protocolVersion: '1' },
  { protocol_version: 1 },
  { history: [{ role: 'user', text: '', status: null }] },
  { history: [{ role: 'user', text: '', imageMissing: 'true' }] },
  { history: [{ role: 'user', text: '', imageMissing: 1 }] },
  { history: [{ role: 'user', text: '', imageMissing: null }] },
  { history: [{ role: 'user', text: '', image_missing: true }] },
  { history: [{ role: 'assistant', text: '', cards: {} }] },
  { learner: { level: 1, completed_lessons: [] } },
  { learner: { level: true, completedLessons: [] } },
  { message: { text: 1, images: [] } },
])('rejects non-wire names and types: %j', (change) => {
  expect(chatTurnRequestSchema.safeParse({ ...request(), ...change }).success).toBe(false)
})

it.each([4000, 4001])('counts %i astral message characters as code points', (count) => {
  expect(chatTurnRequestSchema.safeParse({ ...request(), message: { text: '🎨'.repeat(count), images: [] } }).success).toBe(count <= 4000)
})

it('counts history and card strings using the same Unicode units', () => {
  expect(chatTurnRequestSchema.safeParse({ ...request(), history: [{ role: 'user', text: '🎨'.repeat(60_000) }] }).success).toBe(true)
  expect(chatTurnRequestSchema.safeParse({ ...request(), history: [{ role: 'user', text: '🎨'.repeat(60_001) }] }).success).toBe(false)
  const idea = { type: 'idea', title: '🎨'.repeat(60), description: '🎨'.repeat(220), difficulty: 'beginner', minutes: 5 }
  expect(chatCardSchema.safeParse(idea).success).toBe(true)
  expect(chatCardSchema.safeParse({ ...idea, title: '🎨'.repeat(61) }).success).toBe(false)
})

it('normalizes nullable optional card fields to omission', () => {
  const palette = { type: 'palette', name: 'Rain', colors: ['#112233', '#445566', '#778899'], note: null, roles: null }
  const parsed = chatCardSchema.safeParse(palette)
  expect(parsed.success).toBe(true)
  if (parsed.success) expect(JSON.parse(JSON.stringify(parsed.data))).toEqual({ type: 'palette', name: 'Rain', colors: palette.colors })
  expect(chatCardSchema.safeParse({ type: 'lesson', slug: 'rule-of-thirds', reason: null }).success).toBe(true)
  expect(chatCardSchema.safeParse({ type: 'template', templateId: 'fruit-bowl', reason: null }).success).toBe(true)
})
