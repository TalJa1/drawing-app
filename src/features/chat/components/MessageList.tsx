import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Conversation } from '@/types'
import { useReducedMotion } from '@/app/theme'
import { useChatStream } from '../streamStore'
import { isNearBottom } from '../scroll'
import { MessageItem } from './MessageItem'
import { ScrollToLatest } from './ScrollToLatest'

const positions = new Map<string, number>()

export function MessageList({ conversation, children }: { conversation: Conversation | null; children?: ReactNode }) {
  const { t } = useTranslation()
  const reduced = useReducedMotion()
  const thread = useRef<HTMLDivElement>(null)
  const stick = useRef(true)
  const [latest, setLatest] = useState(false)
  const id = conversation?.id ?? '__new__'
  useLayoutEffect(() => {
    const node = thread.current
    if (!node) return
    const saved = positions.get(id)
    node.scrollTop = saved ?? node.scrollHeight
    stick.current = saved === undefined || isNearBottom(node)
    return () => {
      positions.set(id, node.scrollTop)
    }
  }, [id])
  useEffect(() => {
    let frame = 0
    const notify = () => {
      const node = thread.current
      if (!node) return
      if (!stick.current) {
        setLatest(true)
        return
      }
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => node.scrollTo({ top: node.scrollHeight, behavior: reduced ? 'auto' : 'smooth' }))
    }
    const unsubscribe = useChatStream.subscribe((state, previous) => {
      if (
        state.active?.conversationId === id &&
        (state.active.content !== previous.active?.content || state.active.cards.length !== previous.active?.cards.length)
      )
        notify()
    })
    const observer = new MutationObserver(notify)
    if (thread.current) observer.observe(thread.current, { childList: true, subtree: true, characterData: true })
    return () => {
      unsubscribe()
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [id, reduced])
  const scrollToLatest = () => {
    stick.current = true
    setLatest(false)
    const node = thread.current
    node?.scrollTo({ top: node.scrollHeight, behavior: reduced ? 'auto' : 'smooth' })
  }
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={thread}
        role="region"
        aria-label={t('chat.messages')}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-6 scrollbar-thin sm:px-6"
        onScroll={(event) => {
          stick.current = isNearBottom(event.currentTarget)
          if (stick.current) setLatest(false)
        }}
      >
        {conversation?.messages.length ? (
          <ol className="mx-auto max-w-[720px] space-y-6">
            {conversation.messages.map((message, index) => (
              <MessageItem key={message.id} message={message} conversationId={id} last={index === conversation.messages.length - 1} />
            ))}
          </ol>
        ) : (
          children
        )}
      </div>
      {latest && <ScrollToLatest onClick={scrollToLatest} />}
    </div>
  )
}
