import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'framer-motion'
import { Copy, Image as ImageIcon, Paperclip, RefreshCw, Send, Square, ThumbsDown, ThumbsUp, Upload, X } from 'lucide-react'
import type { ChatAttachment, ChatMode } from '@/types'
import { Page } from '@/components/Layout'
import { IconButton } from '@/components/IconButton'
import { Button } from '@/components/Button'
import { Modal, Sheet } from '@/components/Modal'
import { Markdown } from '@/components/Markdown'
import { Avatar } from '@/components/Avatar'
import { Washes } from '@/components/art/Washes'
import { useArtworks } from '@/api/queries'
import { getImageBlob } from '@/api/artworks'
import { Muse } from '@/features/chat/Muse'
import { ChatCardView } from '@/features/chat/ChatCards'
import { useMuse } from '@/features/chat/useMuse'
import { cn, copyText } from '@/lib/utils'
import { useChat } from '@/store/chat'
import { useSession } from '@/store/session'
import { toast } from '@/store/ui'
import { AttachmentError, prepareImage } from '@/features/chat/attachments'
import type { PreparedImage } from '@/features/chat/attachments'
import { useChatImageUrl } from '@/features/chat/chatImages'
import { useChatStream } from '@/features/chat/streamStore'
import { ConversationList } from '@/features/chat/components/ConversationList'
import { ChatHeader } from '@/features/chat/components/ChatHeader'
import { WelcomeState } from '@/features/chat/components/WelcomeState'
import { useMediaQuery } from '@/lib/hooks'

function AttachPicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (a: PreparedImage) => void }) {
  const { t } = useTranslation()
  const { data } = useArtworks()
  const fileRef = useRef<HTMLInputElement>(null)
  const reportImageError = (error: unknown) => {
    const code = error instanceof AttachmentError ? error.code : 'decode'
    toast({ title: t(code === 'too_big' ? 'chat.attach.tooBig' : `chat.attach.${code}`), tone: 'error' })
  }
  const pickImage = async (blob: Blob, name: string) => {
    try {
      onPick(await prepareImage(blob, name))
      onClose()
    } catch (error) {
      reportImageError(error)
    }
  }
  const pickArtwork = async (key: string, name: string) => {
    try {
      const blob = await getImageBlob(key)
      if (!blob) throw new AttachmentError('decode')
      await pickImage(blob, name)
    } catch (error) {
      reportImageError(error)
    }
  }
  return (
    <Modal open={open} onClose={onClose} title={t('chat.attach.title')} size="lg">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.currentTarget.value = ''
          if (f) void pickImage(f, f.name)
        }}
      />
      <Button variant="outline" icon={<Upload size={16} />} onClick={() => fileRef.current?.click()}>
        {t('chat.attach.upload')}
      </Button>
      <p className="eyebrow mt-6">{t('chat.attach.fromCollection')}</p>
      {data && data.length ? (
        <ul className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
          {data.slice(0, 16).map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => void pickArtwork(a.imageKey, a.title)}
                className="block w-full rounded-xl border border-line p-1 hover:border-ink"
              >
                <ThumbImage k={a.thumbKey} alt={a.title} />
                <span className="mt-1 block truncate text-xs">{a.title}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-ink-faint">{t('chat.attach.empty')}</p>
      )}
    </Modal>
  )
}

function ThumbImage({ k, alt }: { k: string; alt: string }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    void getImageBlob(k).then((b) => b && alive && setSrc(URL.createObjectURL(b)))
    return () => {
      alive = false
    }
  }, [k])
  return src ? (
    <img src={src} alt={alt} className="aspect-[4/3] w-full rounded-lg object-cover" />
  ) : (
    <div className="skeleton aspect-[4/3] w-full rounded-lg" />
  )
}

function MessageImage({ attachment }: { attachment: ChatAttachment }) {
  const src = useChatImageUrl(attachment.previewKey, attachment.src)
  return src ? (
    <img src={src} alt={attachment.name} className="max-h-48 rounded-2xl border border-line object-contain shadow-paper" />
  ) : null
}

function PreparedImagePreview({ image }: { image: PreparedImage }) {
  const [preview, setPreview] = useState<{ blob: Blob; url: string } | null>(null)
  useEffect(() => {
    const url = URL.createObjectURL(image.previewBlob)
    void Promise.resolve().then(() => setPreview({ blob: image.previewBlob, url }))
    return () => URL.revokeObjectURL(url)
  }, [image.previewBlob])
  return preview?.blob === image.previewBlob ? (
    <img src={preview.url} alt={image.name} className="h-16 w-20 rounded-xl border border-line object-cover" />
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
  const active = conversations.find((c) => c.id === activeId) ?? null
  const [mode, setLocalMode] = useState<ChatMode>(active?.mode ?? 'ideas')
  const currentMode = active?.mode ?? mode
  const [text, setText] = useState(() => draft ?? '')
  const [attachments, setAttachments] = useState<PreparedImage[]>([])
  const [picker, setPicker] = useState(false)
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
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // a prompt handed over from another page is used once
  useEffect(() => {
    if (draft) setDraft(null)
  }, [draft, setDraft])

  const lastContent = messages.at(-1)?.content.length ?? 0
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [active?.messages.length, lastContent])

  const submit = async (e?: FormEvent, preset?: string) => {
    e?.preventDefault()
    const message = (preset ?? text).trim()
    if ((!message && !attachments.length) || busy) return
    let convId = activeId
    if (!convId || !conversations.some((c) => c.id === convId)) convId = create(currentMode)
    const atts = attachments
    setText('')
    setAttachments([])
    await send(convId, message, currentMode, atts)
    inputRef.current?.focus()
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
                  onPrompt={(prompt) => {
                    setText(prompt)
                    inputRef.current?.focus()
                  }}
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

            {/* composer */}
            <div className="border-t border-line bg-card/60 px-3 pb-3 pt-3 sm:px-5">
              <AnimatePresence>
                {attachments.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-2 flex gap-2"
                  >
                    {attachments.map((a, i) => (
                      <span key={i} className="relative">
                        <PreparedImagePreview image={a} />
                        <button
                          type="button"
                          aria-label={t('chat.removeAttachment')}
                          onClick={() => setAttachments((x) => x.filter((_, j) => j !== i))}
                          className="absolute -right-1.5 -top-1.5 rounded-full bg-ink p-0.5 text-paper"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
              <form onSubmit={(e) => void submit(e)} className="flex items-end gap-2">
                <IconButton
                  label={t('chat.attach.button')}
                  icon={<Paperclip size={18} />}
                  onClick={() => setPicker(true)}
                  variant="paper"
                />
                <label className="sr-only" htmlFor="chat-input">
                  {t('chat.placeholder')}
                </label>
                <textarea
                  id="chat-input"
                  ref={inputRef}
                  rows={1}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      void submit()
                    }
                  }}
                  placeholder={t('chat.placeholder')}
                  className="max-h-40 min-h-11 flex-1 resize-none rounded-[22px] border border-line-strong bg-card px-4 py-2.5 text-ink placeholder:text-ink-faint/80 focus:border-ink"
                  style={{ fieldSizing: 'content' } as React.CSSProperties}
                />
                {busy ? (
                  <IconButton label={t('chat.stop')} icon={<Square size={16} />} variant="ink" onClick={stop} />
                ) : (
                  <IconButton
                    label={t('chat.send')}
                    icon={<Send size={17} />}
                    variant="ink"
                    type="submit"
                    disabled={!text.trim() && !attachments.length}
                  />
                )}
              </form>
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-faint">
                <ImageIcon size={11} /> {t('chat.disclaimer')}
              </p>
            </div>
          </section>
        </div>
      </div>
      <AttachPicker open={picker} onClose={() => setPicker(false)} onPick={(a) => setAttachments((x) => [...x, a].slice(0, 3))} />
      {!desktop && (
        <Sheet open={sidebar} onClose={() => setSidebar(false)} side="left" title={t('chat.history')}>
          <ConversationList onPick={() => setSidebar(false)} />
        </Sheet>
      )}
    </Page>
  )
}
