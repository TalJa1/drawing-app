import { z } from 'zod'
import type { ChatStreamEvent } from '@/types'
import { chatCardSchema, chatStreamEventSchema } from '@/features/chat/contract'
import { AiTransportError } from './errors'

const cardEnvelope = z.strictObject({ type: z.literal('card'), card: z.record(z.string(), z.unknown()) })

function parseFrame(frame: string): ChatStreamEvent | null {
  const lines = frame.split(/\r?\n/)
  const data = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).replace(/^ /, ''))
    .join('\n')
  if (!data) return null
  let value: unknown
  try {
    value = JSON.parse(data)
  } catch {
    throw new AiTransportError('protocol')
  }
  const envelope = cardEnvelope.safeParse(value)
  if (envelope.success) {
    const card = chatCardSchema.safeParse(envelope.data.card)
    return card.success ? { type: 'card', card: card.data } : null
  }
  const parsed = chatStreamEventSchema.safeParse(value)
  if (!parsed.success) throw new AiTransportError('protocol')
  const name = lines
    .find((line) => line.startsWith('event:'))
    ?.slice(6)
    .trim()
  if (name && name !== parsed.data.type) throw new AiTransportError('protocol')
  return parsed.data
}

export async function* parseSSE(body: ReadableStream<Uint8Array>): AsyncGenerator<ChatStreamEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let separator: RegExpExecArray | null
      while ((separator = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, separator.index)
        buffer = buffer.slice(separator.index + separator[0].length)
        const event = parseFrame(frame)
        if (!event) continue
        yield event
        if (event.type === 'done' || event.type === 'error') return
      }
    }
  } finally {
    try {
      await reader.cancel()
    } catch {
      /* A failed network body is already closed. */
    }
    reader.releaseLock()
  }
}
