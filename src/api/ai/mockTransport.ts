import { buildReply } from '@/api/chat'
import { chatCardSchema } from '@/features/chat/contract'
import { useSettings } from '@/store/settings'
import type { ChatTransport } from './transport'
import { AiTransportError } from './errors'

function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', abort)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort)
      resolve()
    }, ms)
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) abort()
  })
}

export const mockTransport: ChatTransport = {
  async *streamTurn(req, signal) {
    signal.throwIfAborted()
    if (useSettings.getState().simulateErrors) throw new AiTransportError('upstream')
    yield { type: 'status', phase: 'thinking' }
    await pause(600, signal)
    const reply = buildReply({
      message: req.message.text,
      mode: req.mode,
      lang: req.lang,
      attachments: req.message.images.map((image) => ({ kind: 'image', id: image.id, name: image.name })),
      seed: req.action === 'regenerate' ? req.requestId : undefined,
    })
    for (const text of reply.text.match(/\s*\S+/g) ?? []) {
      signal.throwIfAborted()
      yield { type: 'token', text }
      await pause(25, signal)
    }
    for (const card of reply.cards) {
      const parsed = chatCardSchema.safeParse(card)
      if (!parsed.success) continue
      await pause(120, signal)
      yield { type: 'card', card: parsed.data }
    }
    signal.throwIfAborted()
    yield { type: 'done', finish: 'completed' }
  },
}
