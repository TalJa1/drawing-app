import type { AiErrorCode, ChatMessage, ChatMode, ChatStreamEvent, Conversation, ReplyStatus, ReplyVariant } from '@/types'
import type { ChatTransport } from '@/api/ai/transport'
import { AiTransportError } from '@/api/ai/errors'
import { titleFor } from '@/api/chat'
import { uid } from '@/lib/random'
import { useChat } from '@/store/chat'
import type { PreparedImage } from './attachments'
import type { ChatTurnRequest } from './contract'
import { saveChatImages } from './chatImages'
import { useChatStream } from './streamStore'
import type { ActiveStream } from './streamStore'

export type ChatController = {
  send(convId: string, text: string, mode: ChatMode, images: PreparedImage[]): Promise<void>
  regenerate(convId: string): Promise<void>
  retry(convId: string): Promise<void>
  stop(): void
  cancelConversation(convId: string): void
}
type ControllerDeps = {
  transport: ChatTransport
  buildRequest: (conv: Conversation, turnId: string, action: 'send' | 'regenerate') => Promise<ChatTurnRequest>
  recordTurnActivity: () => void
  checkpointMs?: number
}
type RunningTurn = ActiveStream & {
  abort: AbortController
  opened: boolean
  checkpoint?: ReturnType<typeof setInterval>
  flush?: ReturnType<typeof setTimeout>
  finish(status: ReplyStatus, errorCode?: AiErrorCode, incompleteReason?: string): void
}

let current: RunningTurn | null = null
const recordedTurns = new Set<string>()
const qualifiesForActivity = (reply: ReplyVariant) =>
  reply.status === 'completed' || (reply.status === 'stopped' && (!!reply.content || !!reply.cards.length))

function isCurrent(run: RunningTurn): boolean {
  return current === run && useChatStream.getState().active?.requestId === run.requestId
}

function publish(run: RunningTurn) {
  if (!isCurrent(run)) return
  const { requestId, conversationId, turnId, messageId, phase, content, cards } = run
  useChatStream.setState({ active: { requestId, conversationId, turnId, messageId, phase, content, cards: [...cards] } })
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException('Aborted', 'AbortError'))
    signal.addEventListener('abort', abort, { once: true })
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
    if (signal.aborted) {
      signal.removeEventListener('abort', abort)
      abort()
    }
  })
}

useChat.subscribe((state, previous) => {
  if (!current) return
  if (
    !state.conversations.some((c) => c.id === current?.conversationId) ||
    (state.activeId !== previous.activeId && state.activeId !== current.conversationId)
  ) {
    current.finish('stopped')
  }
})

export function createChatController(deps: ControllerDeps): ChatController {
  const begin = (conversationId: string, turnId: string, messageId: string): RunningTurn => {
    const run: RunningTurn = {
      requestId: uid('r_'),
      conversationId,
      turnId,
      messageId,
      phase: 'preparing',
      content: '',
      cards: [],
      abort: new AbortController(),
      opened: false,
      finish(status, errorCode, incompleteReason) {
        if (current !== run) return
        clearInterval(run.checkpoint)
        clearTimeout(run.flush)
        current = null
        run.abort.abort()
        useChatStream.setState({ active: null })
        const conversation = useChat.getState().conversations.find((c) => c.id === conversationId)
        if (run.opened && conversation?.messages.some((m) => m.id === messageId)) {
          useChat
            .getState()
            .commitReply(conversationId, messageId, { content: run.content, cards: [...run.cards], status, errorCode, incompleteReason })
          if (qualifiesForActivity({ content: run.content, cards: run.cards, status, createdAt: '' }) && !recordedTurns.has(turnId)) {
            recordedTurns.add(turnId)
            deps.recordTurnActivity()
          }
        }
      },
    }
    current = run
    useChatStream.setState({
      active: { requestId: run.requestId, conversationId, turnId, messageId, phase: run.phase, content: '', cards: [] },
    })
    return run
  }

  const execute = async (run: RunningTurn, action: 'send' | 'regenerate') => {
    let iterator: AsyncIterator<ChatStreamEvent> | undefined
    try {
      if (!isCurrent(run)) return
      run.checkpoint = setInterval(() => {
        if (isCurrent(run))
          useChat.getState().commitReply(run.conversationId, run.messageId, { content: run.content, cards: [...run.cards] })
      }, deps.checkpointMs ?? 2000)
      const conversation = useChat.getState().conversations.find((c) => c.id === run.conversationId)!
      const request = await abortable(deps.buildRequest(conversation, run.turnId, action), run.abort.signal)
      if (!isCurrent(run)) return
      run.requestId = request.requestId
      run.phase = 'connecting'
      useChatStream.setState({
        active: {
          requestId: run.requestId,
          conversationId: run.conversationId,
          turnId: run.turnId,
          messageId: run.messageId,
          phase: run.phase,
          content: '',
          cards: [],
        },
      })
      iterator = deps.transport.streamTurn(request, run.abort.signal)[Symbol.asyncIterator]()
      while (isCurrent(run)) {
        const result = await abortable(iterator.next(), run.abort.signal)
        if (!isCurrent(run)) return
        if (result.done) {
          run.finish('interrupted')
          return
        }
        const event = result.value
        if (event.type === 'done') {
          run.finish(event.finish === 'completed' ? 'completed' : 'interrupted', undefined, event.reason)
          return
        }
        if (event.type === 'error') {
          run.finish('failed', event.code)
          return
        }
        if (event.type === 'status') {
          run.phase = 'thinking'
          publish(run)
          continue
        }
        run.phase = 'streaming'
        if (event.type === 'token') run.content += event.text
        if (event.type === 'card') run.cards.push(event.card)
        run.flush ??= setTimeout(() => {
          run.flush = undefined
          publish(run)
        }, 40)
      }
    } catch (error) {
      if (!isCurrent(run)) return
      if (error instanceof Error && error.name === 'AbortError') run.finish('stopped')
      else run.finish('failed', error instanceof AiTransportError ? error.code : error instanceof TypeError ? 'network' : 'client')
    } finally {
      if (iterator?.return) void iterator.return().catch(() => undefined)
    }
  }

  const repeat = async (convId: string, action: 'send' | 'regenerate') => {
    if (current) return
    const conversation = useChat.getState().conversations.find((c) => c.id === convId)
    const reply = conversation?.messages.at(-1)
    if (
      !conversation ||
      !reply ||
      reply.role !== 'assistant' ||
      reply.status === 'streaming' ||
      (action === 'send' && reply.status === 'completed')
    )
      return
    const question = conversation.messages.find((m) => m.turnId === reply.turnId && m.role === 'user')
    if (!question) return
    const snapshot: ReplyVariant = {
      content: reply.content,
      cards: reply.cards,
      status: reply.status ?? 'completed',
      createdAt: reply.createdAt,
    }
    if ([snapshot, ...(reply.variants ?? [])].some(qualifiesForActivity)) recordedTurns.add(reply.turnId)
    const run = begin(convId, reply.turnId, reply.id)
    useChat.getState().commitReply(convId, reply.id, {
      content: '',
      cards: [],
      status: 'streaming',
      errorCode: undefined,
      incompleteReason: undefined,
      rating: undefined,
      variants: action === 'regenerate' ? [...(reply.variants ?? []), snapshot] : reply.variants,
    })
    run.opened = true
    await execute(run, action)
  }

  return {
    async send(convId, text, mode, images) {
      if (current || (!text.trim() && !images.length) || !useChat.getState().conversations.some((c) => c.id === convId)) return
      const turnId = uid('t_')
      const run = begin(convId, turnId, uid('m_'))
      try {
        const attachments = images.length ? await abortable(Promise.all(images.map(saveChatImages)), run.abort.signal) : []
        if (!isCurrent(run)) return
        const createdAt = new Date().toISOString()
        const user: ChatMessage = { id: uid('m_'), turnId, role: 'user', content: text, mode, cards: [], attachments, createdAt }
        const reply: ChatMessage = {
          id: run.messageId,
          turnId,
          role: 'assistant',
          content: '',
          cards: [],
          attachments: [],
          createdAt,
          status: 'streaming',
        }
        useChat.setState((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  title: c.title || titleFor(text || attachments[0]?.name || '…'),
                  updatedAt: createdAt,
                  imageContextTurnId: attachments.length ? turnId : c.imageContextTurnId,
                  messages: [...c.messages.map((m) => (m.variants ? { ...m, variants: undefined } : m)), user, reply],
                }
              : c,
          ),
        }))
        run.opened = true
        await execute(run, 'send')
      } catch (error) {
        if (isCurrent(run)) run.finish(error instanceof Error && error.name === 'AbortError' ? 'stopped' : 'failed', 'client')
      }
    },
    regenerate: (convId) => repeat(convId, 'regenerate'),
    retry: (convId) => repeat(convId, 'send'),
    stop: () => current?.finish('stopped'),
    cancelConversation: (convId) => {
      if (current?.conversationId === convId) current.finish('stopped')
    },
  }
}
