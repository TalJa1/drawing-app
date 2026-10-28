import { useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { Ref } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { useReducedMotion } from '@/app/theme'
import { CHAT_MOTION, chatVariants } from '../motion'
import { Paperclip, Send, Square } from 'lucide-react'
import { IconButton } from '@/components/IconButton'
import { useChat } from '@/store/chat'
import { toast } from '@/store/ui'
import { LIMITS } from '../contract'
import { AttachmentError, prepareImage } from '../attachments'
import type { PreparedImage } from '../attachments'
import { AttachmentStrip } from './AttachmentStrip'
import { AttachmentPicker } from './AttachmentPicker'
import { ChatPrivacy } from './ChatPrivacy'

export type ChatComposerHandle = { fill: (text: string) => void; focus: () => void }

export function ChatComposer({
  conversationId,
  initialText,
  busy,
  onSend,
  onStop,
  ref,
}: {
  conversationId: string
  initialText: string
  busy: boolean
  onSend: (text: string, images: PreparedImage[]) => void | Promise<void>
  onStop: () => void
  ref?: Ref<ChatComposerHandle>
}) {
  const { t } = useTranslation()
  const reduced = useReducedMotion()
  const [text, setText] = useState(initialText.slice(0, LIMITS.maxMessageChars))
  const [images, setImages] = useState<PreparedImage[]>([])
  const [preparing, setPreparing] = useState(0)
  const [picker, setPicker] = useState(false)
  const [resetVersion] = useState(() => useChat.getState().resetVersion)
  const input = useRef<HTMLTextAreaElement>(null)
  const latest = useRef(text)
  const imageCount = useRef(0)
  const alive = useRef(true)
  const changeText = (value: string) => {
    const next = value.slice(0, LIMITS.maxMessageChars)
    latest.current = next
    setText(next)
  }
  useImperativeHandle(
    ref,
    () => ({
      focus: () => input.current?.focus(),
      fill: (value) => {
        changeText(value)
        input.current?.focus()
      },
    }),
    [],
  )
  useEffect(() => {
    const timer = setTimeout(() => useChat.getState().setConversationDraft(conversationId, text), 400)
    return () => clearTimeout(timer)
  }, [conversationId, text])
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      const state = useChat.getState()
      if (
        state.resetVersion === resetVersion &&
        (conversationId === '__new__' || state.conversations.some((c) => c.id === conversationId))
      ) {
        state.setConversationDraft(conversationId, latest.current)
      }
    }
  }, [conversationId, resetVersion])
  const addImage = (image: PreparedImage) => {
    if (!alive.current || imageCount.current >= LIMITS.maxImagesPerRequest) return
    imageCount.current++
    setImages((current) => [...current, image])
  }
  const paste = async (files: File[]) => {
    const batch = files.slice(0, LIMITS.maxImagesPerRequest - imageCount.current)
    imageCount.current += batch.length
    setPreparing((count) => count + batch.length)
    await Promise.all(
      batch.map(async (file) => {
        try {
          const image = await prepareImage(file, file.name)
          if (alive.current) setImages((current) => [...current, image])
        } catch (error) {
          imageCount.current--
          if (alive.current)
            toast({ title: t(`chat.attach.errors.${error instanceof AttachmentError ? error.code : 'decode'}`), tone: 'error' })
        } finally {
          if (alive.current) setPreparing((count) => count - 1)
        }
      }),
    )
  }
  const submit = () => {
    if (busy || preparing || (!text.trim() && !images.length)) return
    const message = text.trim()
    const attachments = images
    changeText('')
    setImages([])
    imageCount.current = 0
    useChat.getState().setConversationDraft(conversationId, '')
    void onSend(message, attachments)
    input.current?.focus()
  }
  return (
    <div
      className="border-t border-line bg-card/60 px-3 pt-3 sm:px-5"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      {(images.length > 0 || preparing > 0) && (
        <AttachmentStrip
          images={images}
          preparing={preparing}
          onRemove={(id) => {
            setImages((current) => current.filter((image) => image.id !== id))
            imageCount.current--
          }}
        />
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
        className="flex items-end gap-2"
      >
        <IconButton
          noTooltip
          className="h-11 w-11"
          label={t('chat.attach.button')}
          icon={<Paperclip size={18} />}
          onClick={() => setPicker(true)}
          disabled={busy || images.length + preparing >= LIMITS.maxImagesPerRequest}
          variant="paper"
        />
        <label className="sr-only" htmlFor="chat-input">
          {t('chat.placeholder')}
        </label>
        <textarea
          id="chat-input"
          ref={input}
          rows={1}
          maxLength={LIMITS.maxMessageChars}
          value={text}
          onChange={(event) => changeText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) {
              event.preventDefault()
              submit()
            }
          }}
          onPaste={(event) => {
            const files = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith('image/'))
            if (files.length && !busy) {
              event.preventDefault()
              void paste(files)
            }
          }}
          placeholder={t('chat.placeholder')}
          className="transition-[border-color,box-shadow] duration-150 focus:shadow-paper max-h-40 min-h-11 min-w-0 flex-1 resize-none rounded-[22px] border border-line-strong bg-card px-4 py-2.5 text-base text-ink placeholder:text-ink-faint/80 focus:border-ink"
          style={{ fieldSizing: 'content', transitionDuration: reduced ? '0s' : `${CHAT_MOTION.focus}s` }}
        />
        {busy ? (
          <IconButton
            noTooltip
            className="h-11 w-11"
            label={t('chat.stop')}
            icon={
              <motion.span
                key="stop"
                variants={chatVariants(reduced).threadSwap}
                initial="hidden"
                animate="visible"
                transition={{ duration: CHAT_MOTION.sendStop }}
              >
                <Square size={16} />
              </motion.span>
            }
            variant="ink"
            onClick={onStop}
          />
        ) : (
          <IconButton
            noTooltip
            className="h-11 w-11"
            label={t('chat.send')}
            icon={
              <motion.span
                key="send"
                variants={chatVariants(reduced).threadSwap}
                initial="hidden"
                animate="visible"
                transition={{ duration: CHAT_MOTION.sendStop }}
              >
                <Send size={17} />
              </motion.span>
            }
            variant="ink"
            type="submit"
            disabled={!!preparing || (!text.trim() && !images.length)}
          />
        )}
      </form>
      <ChatPrivacy />
      <AttachmentPicker
        open={picker}
        onClose={() => setPicker(false)}
        onPick={addImage}
        disabled={busy || images.length + preparing >= LIMITS.maxImagesPerRequest}
      />
    </div>
  )
}
