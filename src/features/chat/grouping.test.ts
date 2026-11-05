import type { Conversation } from '@/types'
import { groupConversations } from './grouping'

it('groups by today/yesterday/week/older on local dates', () => {
  const now = new Date(2026, 9, 27, 0, 5)
  const item = (id: string, day: number, hour = 12): Conversation => ({
    id,
    title: id,
    mode: 'ideas',
    messages: [],
    createdAt: now.toISOString(),
    updatedAt: new Date(2026, 9, day, hour, 59).toISOString(),
  })
  const today = item('today', 27, 0)
  const yesterday = item('yesterday', 26, 23)
  const week = item('week', 22)
  const older = item('older', 19)
  const input = [older, yesterday, week, today]
  expect(groupConversations(input, now)).toEqual([
    { key: 'today', items: [today] },
    { key: 'yesterday', items: [yesterday] },
    { key: 'week', items: [week] },
    { key: 'older', items: [older] },
  ])
  expect(input).toEqual([older, yesterday, week, today])
})
