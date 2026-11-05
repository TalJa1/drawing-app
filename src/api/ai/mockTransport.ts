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

/**
 * The templates the server has, for the mock reply to suggest from; none when they cannot be had (offline).
 * Loaded on demand: the query layer listens to the session, which a transport must not pull in just by being imported.
 */
async function serverTemplates() {
  try {
    const [{ queryClient }, { qk }, { getTemplates }] = await Promise.all([import('@/app/queryClient'), import('@/api/queries'), import('@/api/templates')])
    return await queryClient.ensureQueryData({ queryKey: qk.templates, queryFn: getTemplates })
  } catch {
    return []
  }
}

export function createMockTransport({
  cardsFirst = false,
  textDelayMs = 0,
}: { cardsFirst?: boolean; textDelayMs?: number } = {}): ChatTransport {
  return {
    async *streamTurn(req, signal) {
      signal.throwIfAborted()
      if (useSettings.getState().simulateErrors) throw new AiTransportError('upstream')
      yield { type: 'status', phase: 'thinking' }
      await pause(600, signal)
      // the chat is a mock, but the templates it suggests are the server's; without them (offline) the card is simply left out
      const templates = await serverTemplates()
      signal.throwIfAborted()
      const reply = buildReply(
        {
          message: req.message.text,
          mode: req.mode,
          lang: req.lang,
          attachments: req.message.images.map((image) => ({ kind: 'image', id: image.id, name: image.name })),
          seed: req.action === 'regenerate' ? req.requestId : undefined,
        },
        templates,
      )
      const cards = reply.cards.flatMap((card) => {
        const parsed = chatCardSchema.safeParse(card)
        return parsed.success ? [parsed.data] : []
      })
      if (cardsFirst) {
        for (const card of cards) {
          await pause(120, signal)
          yield { type: 'card', card }
        }
        await pause(textDelayMs, signal)
      }
      for (const text of reply.text.match(/\s*\S+/g) ?? []) {
        signal.throwIfAborted()
        yield { type: 'token', text }
        await pause(25, signal)
      }
      if (!cardsFirst)
        for (const card of cards) {
          await pause(120, signal)
          yield { type: 'card', card }
        }
      signal.throwIfAborted()
      yield { type: 'done', finish: 'completed' }
    },
  }
}

export const mockTransport = /* @__PURE__ */ createMockTransport()
