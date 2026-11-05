import type { Conversation } from '@/types'

export function groupConversations(
  list: Conversation[],
  now: Date,
): { key: 'today' | 'yesterday' | 'week' | 'older'; items: Conversation[] }[] {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(start)
  yesterday.setDate(start.getDate() - 1)
  const week = new Date(start)
  week.setDate(start.getDate() - 7)
  const groups = { today: [] as Conversation[], yesterday: [] as Conversation[], week: [] as Conversation[], older: [] as Conversation[] }
  for (const item of [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))) {
    const date = new Date(item.updatedAt)
    const key = date >= start ? 'today' : date >= yesterday ? 'yesterday' : date >= week ? 'week' : 'older'
    groups[key].push(item)
  }
  return (['today', 'yesterday', 'week', 'older'] as const).filter((key) => groups[key].length).map((key) => ({ key, items: groups[key] }))
}
