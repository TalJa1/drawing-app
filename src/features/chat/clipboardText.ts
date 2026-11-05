import type { TFunction } from 'i18next'
import type { ChatCard, ChatMessage, Lesson, Localized, Template } from '@/types'

type Localize = (value: Localized) => string

/** Finds a template or lesson in the lists the server sent (`useTemplateLookup` / `useLessonLookup`); `undefined` when absent. */
export interface CatalogLookup {
  templateOf: (id: string | undefined) => Template | undefined
  lessonOf: (slug: string | undefined) => Lesson | undefined
}

function cardText(card: ChatCard, t: TFunction, L: Localize, catalog: CatalogLookup): string {
  switch (card.type) {
    case 'palette':
      return [
        card.name,
        ...card.colors.map((hex, index) => {
          const role = card.roles?.[index]
          return role ? `${hex.toUpperCase()} · ${t(`chat.cards.roles.${role}`)}` : hex.toUpperCase()
        }),
        card.note,
      ]
        .filter(Boolean)
        .join('\n')
    case 'lesson': {
      const lesson = catalog.lessonOf(card.slug)
      return lesson
        ? [`${t('chat.cards.lesson', { count: lesson.minutes })}: ${L(lesson.title)}`, card.reason].filter(Boolean).join('\n')
        : ''
    }
    case 'template': {
      const template = catalog.templateOf(card.templateId)
      return template ? [`${t('chat.cards.template')}: ${L(template.title)}`, card.reason].filter(Boolean).join('\n') : ''
    }
    case 'idea':
      return [card.title, card.description, `${t(`difficulty.${card.difficulty}`)} · ${t('common.minutes', { count: card.minutes })}`].join(
        '\n',
      )
    case 'critique':
      return (
        [
          ['observations', card.observations],
          ['strengths', card.strengths],
          ['priorities', card.priorities],
          ['exercise', [card.exercise]],
        ] as const
      )
        .filter(([, points]) => points.length > 0)
        .map(([name, points]) => [t(`chat.cards.critique.${name}`), ...points.map((point) => `- ${point}`)].join('\n'))
        .join('\n')
  }
}

/** What Copy puts on the clipboard: the written reply, then each card's details in the interface language. */
export function replyClipboardText(
  message: Pick<ChatMessage, 'content' | 'cards'>,
  t: TFunction,
  L: Localize,
  catalog: CatalogLookup,
): string {
  return [message.content.trim(), ...message.cards.map((card) => cardText(card, t, L, catalog))].filter(Boolean).join('\n\n')
}
