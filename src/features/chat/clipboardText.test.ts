import type { TFunction } from 'i18next'
import type { Localized } from '@/types'
import { replyClipboardText } from './clipboardText'

const t = ((key: string, options?: { count?: number }) =>
  options?.count === undefined ? key : `${key}:${options.count}`) as unknown as TFunction
const L = (value: Localized) => value.en

it('a card-only palette reply copies its colours, roles and note', () => {
  const text = replyClipboardText(
    {
      content: '',
      cards: [
        {
          type: 'palette',
          name: 'Dusk',
          colors: ['#112233', '#445566', '#778899'],
          roles: ['dominant', 'support', 'accent'],
          note: 'Keep it calm',
        },
      ],
    },
    t,
    L,
  )
  expect(text).toBe(
    'Dusk\n#112233 · chat.cards.roles.dominant\n#445566 · chat.cards.roles.support\n#778899 · chat.cards.roles.accent\nKeep it calm',
  )
})

it('written text comes first and each card follows as its own block', () => {
  const text = replyClipboardText(
    {
      content: '  Try this.  ',
      cards: [
        { type: 'idea', title: 'Pond', description: 'Draw a pond at dusk', difficulty: 'beginner', minutes: 15 },
        {
          type: 'critique',
          imageId: 'a_1',
          observations: ['Strong diagonal'],
          strengths: [],
          priorities: ['Darken the shadows'],
          exercise: 'Three value studies',
        },
      ],
    },
    t,
    L,
  )
  expect(text.split('\n\n')).toEqual([
    'Try this.',
    'Pond\nDraw a pond at dusk\ndifficulty.beginner · common.minutes:15',
    'chat.cards.critique.observations\n- Strong diagonal\nchat.cards.critique.priorities\n- Darken the shadows\nchat.cards.critique.exercise\n- Three value studies',
  ])
})

it('nothing to copy yields an empty string', () => {
  expect(replyClipboardText({ content: '   ', cards: [{ type: 'lesson', slug: 'not-in-catalog' }] }, t, L)).toBe('')
})
