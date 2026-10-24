import { buildReply, detectIntent } from './chat'

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
    const r = buildReply({ message: 'cho mình vài ý tưởng vẽ', mode: 'ideas', lang: 'vi' })
    expect(r.cards.some((c) => c.type === 'idea')).toBe(true)
    expect(r.cards.some((c) => c.type === 'template')).toBe(true)
    expect(r.text).toMatch(/ý tưởng/)
  })

  it('regenerates differently with a new seed', () => {
    const a = buildReply({ message: 'drawing ideas please', mode: 'ideas', lang: 'en', seed: '1' })
    const b = buildReply({ message: 'drawing ideas please', mode: 'ideas', lang: 'en', seed: '2' })
    expect(a.text === b.text && JSON.stringify(a.cards) === JSON.stringify(b.cards)).toBe(false)
  })
})
