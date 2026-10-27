import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Copy, RefreshCw, ThumbsDown, ThumbsUp } from 'lucide-react'
import type { ChatAttachment, ChatMode } from '@/types'
import { Page } from '@/components/Layout'
import { IconButton } from '@/components/IconButton'
import { Button } from '@/components/Button'
import { Sheet } from '@/components/Modal'
import { Markdown } from '@/components/Markdown'
import { Avatar } from '@/components/Avatar'
import { Washes } from '@/components/art/Washes'
import { Muse } from '@/features/chat/Muse'
import { ChatCardView } from '@/features/chat/ChatCards'
import { useMuse } from '@/features/chat/useMuse'
import { cn, copyText } from '@/lib/utils'
import { useChat } from '@/store/chat'
import { useSession } from '@/store/session'
import { toast } from '@/store/ui'
import type { PreparedImage } from '@/features/chat/attachments'
import { useChatImageUrl } from '@/features/chat/chatImages'
import { useChatStream } from '@/features/chat/streamStore'
import { ConversationList } from '@/features/chat/components/ConversationList'
import { ChatHeader } from '@/features/chat/components/ChatHeader'
import { WelcomeState } from '@/features/chat/components/WelcomeState'
import { ChatComposer } from '@/features/chat/components/ChatComposer'
import type { ChatComposerHandle } from '@/features/chat/components/ChatComposer'
import { useMediaQuery } from '@/lib/hooks'

function MessageImage({ attachment }: { attachment: ChatAttachment }) {
  const src = useChatImageUrl(attachment.previewKey, attachment.src)
  return src ? (
    <img src={src} alt={attachment.name} className="max-h-48 rounded-2xl border border-line object-contain shadow-paper" />
  ) : null
}

export default function ChatPage() {
  const { t } = useTranslation()
  const user = useSession((s) => s.user)
  const conversations = useChat((s) => s.conversations)
  const activeId = useChat((s) => s.activeId)
  const create = useChat((s) => s.create)
  const setMode = useChat((s) => s.setMode)
  const updateMessage = useChat((s) => s.updateMessage)
  const draft = useChat((s) => s.draft)
  const setDraft = useChat((s) => s.setDraft)
  const drafts = useChat((s) => s.drafts)
  const setActive = useChat((s) => s.setActive)
  const active = conversations.find((c) => c.id === activeId) ?? null
  const [mode, setLocalMode] = useState<ChatMode>(active?.mode ?? 'ideas')
  const currentMode = active?.mode ?? mode
  const [sidebar, setSidebar] = useState(false)
  const desktop = useMediaQuery('(min-width: 1024px)')
  const { phase, send, regenerate, retry, stop } = useMuse()
  useEffect(() => () => stop(), [stop])
  const busy = phase !== null
  const streaming = useChatStream((s) => s.active)
  const messages =
    active?.messages.map((message) =>
      streaming?.conversationId === active.id && streaming.messageId === message.id
        ? { ...message, content: streaming.content, cards: streaming.cards }
        : message,
    ) ?? []
  const endRef = useRef<HTMLDivElement>(null)
  const composer = useRef<ChatComposerHandle>(null)
  const composerId = draft !== null ? '__new__' : (active?.id ?? '__new__')

  useEffect(() => {
    if (draft === null) return
    setActive(null)
    useChat.getState().setConversationDraft('__new__', draft)
    setDraft(null)
  }, [draft, setDraft, setActive])

  const lastContent = messages.at(-1)?.content.length ?? 0
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [active?.messages.length, lastContent])

  const submit = async (message: string, attachments: PreparedImage[]) => {
    if (busy) return
    let convId = activeId
    if (!convId || !conversations.some((c) => c.id === convId)) convId = create(currentMode)
    await send(convId, message, currentMode, attachments)
  }

  const changeMode = (m: ChatMode) => {
    setLocalMode(m)
    if (active) setMode(active.id, m)
  }

  const lastAssistant = active?.messages.at(-1)?.role === 'assistant' ? active.messages.at(-1) : undefined

  return (
    <Page className="!pb-24 md:!pb-10">
      <Washes
        washes={[
          { color: 'var(--rose)', size: '34vmax', top: '-10%', right: '-10%' },
          { color: 'var(--cerulean)', size: '28vmax', bottom: '-10%', left: '-12%', delay: -10 },
        ]}
      />
      <div className="container-art">
        <div className="grid h-[calc(100dvh-12rem)] min-h-[560px] gap-6 md:h-[calc(100dvh-11rem)] lg:grid-cols-[272px_1fr]">
          {desktop && (
            <aside className="paper hidden rounded-[26px] border border-line p-4 shadow-paper lg:block" aria-label={t('chat.history')}>
              <ConversationList />
            </aside>
          )}
          <section
            className="paper relative flex min-h-0 flex-col overflow-hidden rounded-[26px] border border-line shadow-paper"
            aria-label={t('chat.title')}
          >
            <ChatHeader
              title={active?.title}
              mode={currentMode}
              onModeChange={changeMode}
              desktop={desktop}
              onHistory={() => setSidebar(true)}
            />

            {/* thread */}
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-6 scrollbar-thin sm:px-6" aria-live="polite">
              {!active || active.messages.length === 0 ? (
                <WelcomeState
                  mode={currentMode}
                  name={user.displayName.split(' ')[0]}
                  onPrompt={(prompt) => composer.current?.fill(prompt)}
                />
              ) : (
                <ol className="mx-auto max-w-[720px] space-y-6">
                  {messages.map((m) => (
                    <motion.li
                      key={m.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn('flex gap-3', m.role === 'user' && 'flex-row-reverse')}
                    >
                      {m.role === 'user' ? (
                        <Avatar seed={user.avatarSeed} size={34} className="mt-1" />
                      ) : (
                        <span className="mt-1 flex h-[34px] w-[34px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-paper-3">
                          <Muse size={34} />
                        </span>
                      )}
                      <div className={cn('flex min-w-0 max-w-[85%] flex-col gap-2', m.role === 'user' && 'items-end')}>
                        {m.attachments.map((a) => (
                          <MessageImage key={a.id} attachment={a} />
                        ))}
                        {(m.content || m.status === 'streaming') && (
                          <div
                            className={cn(
                              'rounded-[20px] px-4 py-3',
                              m.role === 'user' ? 'rounded-tr-md bg-ink text-paper' : 'rounded-tl-md border border-line bg-card',
                            )}
                          >
                            {m.role === 'user' ? (
                              <p className="whitespace-pre-wrap">{m.content}</p>
                            ) : m.status === 'streaming' && !m.content ? (
                              <p className="flex items-center gap-2 text-ink-faint">
                                <span className="flex gap-1" aria-hidden>
                                  {[0, 1, 2].map((d) => (
                                    <span
                                      key={d}
                                      className="h-2 w-2 rounded-full bg-saffron"
                                      style={{ animation: `float-y 1s ${d * 0.15}s ease-in-out infinite` }}
                                    />
                                  ))}
                                </span>
                                <span className="hand text-lg">{t('chat.thinking')}</span>
                              </p>
                            ) : (
                              <Markdown text={m.content} className="text-[0.97rem] leading-relaxed text-ink-soft" />
                            )}
                          </div>
                        )}
                        {m.id === lastAssistant?.id && (m.status === 'failed' || m.status === 'interrupted' || m.status === 'stopped') && (
                          <div className="flex items-center gap-2 rounded-2xl border border-vermilion/40 bg-vermilion/10 px-3 py-2 text-sm">
                            {t('chat.error')}
                            <Button
                              size="sm"
                              variant="ghost"
                              icon={<RefreshCw size={14} />}
                              onClick={() => active && void retry(active.id)}
                            >
                              {t('common.retry')}
                            </Button>
                          </div>
                        )}
                        {m.cards.length > 0 && (
                          <div className="flex flex-wrap gap-3">
                            {m.cards.map((c, i) => (
                              <motion.div key={i} initial={{ opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}>
                                <ChatCardView card={c} />
                              </motion.div>
                            ))}
                          </div>
                        )}
                        {m.role === 'assistant' && m.status !== 'streaming' && m.status !== 'failed' && m.content && (
                          <div className="flex gap-0.5">
                            <IconButton
                              size="sm"
                              label={t('common.copy')}
                              icon={<Copy size={14} />}
                              onClick={async () =>
                                toast({
                                  title: (await copyText(m.content)) ? t('common.copied') : t('learn.lab.copyFailed'),
                                  tone: 'success',
                                })
                              }
                            />
                            <IconButton
                              size="sm"
                              label={t('chat.helpful')}
                              active={m.rating === 'up'}
                              icon={<ThumbsUp size={14} />}
                              onClick={() => active && updateMessage(active.id, m.id, { rating: m.rating === 'up' ? undefined : 'up' })}
                            />
                            <IconButton
                              size="sm"
                              label={t('chat.notHelpful')}
                              active={m.rating === 'down'}
                              icon={<ThumbsDown size={14} />}
                              onClick={() => active && updateMessage(active.id, m.id, { rating: m.rating === 'down' ? undefined : 'down' })}
                            />
                            {m.id === lastAssistant?.id && (
                              <IconButton
                                size="sm"
                                label={t('chat.regenerate')}
                                icon={<RefreshCw size={14} />}
                                onClick={() => active && void regenerate(active.id)}
                                disabled={busy}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    </motion.li>
                  ))}
                </ol>
              )}
              <div ref={endRef} />
            </div>

            <ChatComposer
              key={composerId}
              ref={composer}
              conversationId={composerId}
              initialText={draft ?? drafts[composerId] ?? ''}
              busy={busy}
              onSend={submit}
              onStop={stop}
            />
          </section>
        </div>
      </div>
      {!desktop && (
        <Sheet open={sidebar} onClose={() => setSidebar(false)} side="left" title={t('chat.history')}>
          <ConversationList onPick={() => setSidebar(false)} />
        </Sheet>
      )}
    </Page>
  )
}
