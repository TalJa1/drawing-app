import type { ChatMessage, Conversation } from '@/types'

export function makeLongThread(): Conversation {
  const createdAt = '2026-10-28T00:00:00.000Z'
  const messages: ChatMessage[] = Array.from({ length: 100 }, (_, index) => {
    const assistant = index % 2 === 1
    return {
      id: `long_${index}`,
      turnId: `turn_${Math.floor(index / 2)}`,
      role: assistant ? 'assistant' : 'user',
      mode: 'composition',
      content: assistant
        ? `Study ${index}: **value and composition**\n\nKeep the focal point clear. Simplify the background into three large shapes.\n\n- Squint at the drawing.\n- Darken one shadow.\n- Compare the silhouette.`
        : `How can I improve the composition of drawing ${index}?`,
      cards: assistant && index % 10 === 1 ? [{ type: 'palette', name: `Study ${index}`, colors: ['#123456', '#abcdef', '#f6f1e7'] }] : [],
      attachments: [],
      createdAt,
      ...(assistant ? { status: index === 99 ? 'streaming' : 'completed' } : {}),
    }
  })
  return { id: 'long_thread', title: 'Value studies', mode: 'composition', messages, createdAt, updatedAt: createdAt }
}
