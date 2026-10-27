import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatAttachment, ChatMessage, ChatMode } from '@/types'
import { streamChatReply, titleFor } from '@/api/chat'
import { recordActivity } from '@/api/progress'
import { uid } from '@/lib/random'
import { useChat } from '@/store/chat'
import { useSettings } from '@/store/settings'
import { presentReward } from '@/store/ui'

/** Sends messages to the (mock) muse and streams replies into the chat store. */
export function useMuse() {
  const [busy, setBusy] = useState(false)
  const abort = useRef<AbortController | null>(null)

  useEffect(() => () => abort.current?.abort(), [])

  const stream = useCallback(
    async (convId: string, text: string, mode: ChatMode, attachments: ChatAttachment[], turnId: string, seed?: string) => {
      const store = useChat.getState()
      const reply: ChatMessage = {
        id: uid('m_'),
        role: 'assistant',
        content: '',
        cards: [],
        attachments: [],
        createdAt: new Date().toISOString(),
        turnId,
        status: 'streaming',
      }
      store.addMessage(convId, reply)
      const ctrl = new AbortController()
      abort.current = ctrl
      setBusy(true)
      let content = ''
      const cards: ChatMessage['cards'] = []
      let lastFlush = 0
      const flush = (force = false) => {
        const now = performance.now()
        if (!force && now - lastFlush < 45) return
        lastFlush = now
        useChat.getState().updateMessage(convId, reply.id, { content, cards: [...cards] })
      }
      try {
        for await (const ev of streamChatReply(
          { message: text, mode, lang: useSettings.getState().language, attachments, seed },
          ctrl.signal,
        )) {
          if (ev.type === 'token') content += ev.text
          if (ev.type === 'card') cards.push(ev.card)
          flush(ev.type !== 'token')
        }
        useChat.getState().updateMessage(convId, reply.id, { content, cards, status: 'completed' })
      } catch {
        useChat.getState().updateMessage(convId, reply.id, { content, cards, status: 'failed' })
      } finally {
        setBusy(false)
        if (abort.current === ctrl) abort.current = null
      }
    },
    [],
  )

  const send = useCallback(
    async (convId: string, text: string, mode: ChatMode, attachments: ChatAttachment[] = []) => {
      const store = useChat.getState()
      const conv = store.conversations.find((c) => c.id === convId)
      if (conv && !conv.title) store.rename(convId, titleFor(text || attachments[0]?.name || '…'))
      const turnId = uid('t_')
      store.addMessage(convId, {
        turnId,
        mode,
        id: uid('m_'),
        role: 'user',
        content: text,
        cards: [],
        attachments,
        createdAt: new Date().toISOString(),
      })
      void recordActivity({ type: 'chatMessage' }).then(presentReward)
      await stream(convId, text, mode, attachments, turnId)
    },
    [stream],
  )

  /** Replace an assistant reply with a fresh one for the same question. */
  const regenerate = useCallback(
    async (convId: string, messageId: string, mode: ChatMode) => {
      const conv = useChat.getState().conversations.find((c) => c.id === convId)
      if (!conv) return
      const idx = conv.messages.findIndex((m) => m.id === messageId)
      const question = [...conv.messages.slice(0, idx)].reverse().find((m) => m.role === 'user')
      if (!question) return
      useChat.getState().removeMessage(convId, messageId)
      await stream(convId, question.content, mode, question.attachments, question.turnId, uid('seed'))
    },
    [stream],
  )

  const stop = useCallback(() => abort.current?.abort(), [])

  return { busy, send, regenerate, stop }
}
