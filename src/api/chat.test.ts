import type { Template } from '@/types'
import { buildReply, detectIntent } from './chat'

const SERVER_TEMPLATES: Template[] = [
  {
    id: 'starter',
    title: { en: 'Starter', vi: 'Khởi đầu' },
    category: 'animals',
    difficulty: 'beginner',
    minutes: 10,
    svg: '<svg xmlns="http://www.w3.org/2000/svg"/>',
    tags: [],
    popularity: 1,
    unlockLevel: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    suggestedPalette: [],
  },
]

describe('mock AI muse', () => {
  it('detects intents in English and Vietnamese', () => {
    expect(detectIntent('Give me 5 drawing ideas for beginners', 'ideas', false)).toBe('ideas')
    expect(detectIntent('Which colours go well with teal?', 'ideas', false)).toBe('colour')
    expect(detectIntent('How can I improve my composition?', 'ideas', false)).toBe('composition')
    expect(detectIntent('Explain Impressionism like I’m 12', 'ideas', false)).toBe('history')
    expect(detectIntent('Create a 7-day drawing challenge for me', 'ideas', false)).toBe('challenge')
    expect(detectIntent('Màu nào hợp với xanh mòng két?', 'ideas', false)).toBe('colour')
    expect(detectIntent('xin chào', 'ideas', false)).toBe('greeting')
    expect(detectIntent('anything', 'ideas', true)).toBe('feedback')
  })

  it('falls back to the mode’s intent for longer unknown messages', () => {
    expect(detectIntent('tell me something lovely about bananas', 'history', false)).toBe('history')
  })

  it('returns palette cards for colour questions', () => {
    const r = buildReply({ message: 'colours that go with teal', mode: 'colour', lang: 'en' })
    expect(r.cards.filter((c) => c.type === 'palette').length).toBeGreaterThanOrEqual(3)
  })

  it('returns idea and template cards for idea requests, in the requested language', () => {
    const r = buildReply({ message: 'cho mình vài ý tưởng vẽ', mode: 'ideas', lang: 'vi' }, SERVER_TEMPLATES)
    expect(r.cards.some((c) => c.type === 'idea')).toBe(true)
    expect(r.cards.some((c) => c.type === 'template')).toBe(true)
    expect(r.text).toMatch(/ý tưởng/)
  })

  it('only suggests a beginner template the server has', () => {
    for (const seed of ['a', 'b', 'c', 'd']) {
      const r = buildReply({ message: 'drawing ideas please', mode: 'ideas', lang: 'en', seed }, SERVER_TEMPLATES)
      const card = r.cards.find((c) => c.type === 'template')
      expect(card).toEqual({ type: 'template', templateId: 'starter' })
    }
  })

  it('leaves the template card out when it has no templates (offline, or none are beginner)', () => {
    const ask = { message: 'drawing ideas please', mode: 'ideas', lang: 'en' } as const
    expect(buildReply(ask).cards.some((c) => c.type === 'template')).toBe(false)
    expect(buildReply(ask, [{ ...SERVER_TEMPLATES[0], difficulty: 'advanced' }]).cards.some((c) => c.type === 'template')).toBe(false)
    expect(buildReply(ask).cards.some((c) => c.type === 'idea')).toBe(true)
  })

  it('the 7-day challenge points at the sunflower only if the server has it', () => {
    const ask = { message: 'Create a 7-day drawing challenge for me', mode: 'ideas', lang: 'en' } as const
    expect(buildReply(ask, [{ ...SERVER_TEMPLATES[0], id: 'sunflower' }]).cards).toEqual([{ type: 'template', templateId: 'sunflower' }])
    expect(buildReply(ask, SERVER_TEMPLATES).cards).toEqual([])
  })

  it('regenerates differently with a new seed', () => {
    const a = buildReply({ message: 'drawing ideas please', mode: 'ideas', lang: 'en', seed: '1' })
    const b = buildReply({ message: 'drawing ideas please', mode: 'ideas', lang: 'en', seed: '2' })
    expect(a.text === b.text && JSON.stringify(a.cards) === JSON.stringify(b.cards)).toBe(false)
  })
})
