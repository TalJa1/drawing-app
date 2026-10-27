import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ChatMode } from '@/types'
import { Page } from '@/components/Layout'
import { Sheet } from '@/components/Modal'
import { Washes } from '@/components/art/Washes'
import { useMuse } from '@/features/chat/useMuse'
import { useChat } from '@/store/chat'
import { useSession } from '@/store/session'
import type { PreparedImage } from '@/features/chat/attachments'
import { ConversationList } from '@/features/chat/components/ConversationList'
import { ChatHeader } from '@/features/chat/components/ChatHeader'
import { WelcomeState } from '@/features/chat/components/WelcomeState'
import { ChatComposer } from '@/features/chat/components/ChatComposer'
import type { ChatComposerHandle } from '@/features/chat/components/ChatComposer'
import { MessageList } from '@/features/chat/components/MessageList'
import { ChatStatus } from '@/features/chat/components/ChatStatus'
import { useMediaQuery } from '@/lib/hooks'

export default function ChatPage() {
  const { t } = useTranslation()
  const user = useSession((s) => s.user)
  const conversations = useChat((s) => s.conversations)
  const activeId = useChat((s) => s.activeId)
  const create = useChat((s) => s.create)
  const setMode = useChat((s) => s.setMode)
  const draft = useChat((s) => s.draft)
  const setDraft = useChat((s) => s.setDraft)
  const drafts = useChat((s) => s.drafts)
  const setActive = useChat((s) => s.setActive)
  const active = conversations.find((c) => c.id === activeId) ?? null
  const [mode, setLocalMode] = useState<ChatMode>(active?.mode ?? 'ideas')
  const currentMode = active?.mode ?? mode
  const [sidebar, setSidebar] = useState(false)
  const desktop = useMediaQuery('(min-width: 1024px)')
  const { phase, send, stop } = useMuse()
  useEffect(() => () => stop(), [stop])
  const busy = phase !== null
  const composer = useRef<ChatComposerHandle>(null)
  const composerId = draft !== null ? '__new__' : (active?.id ?? '__new__')

  useEffect(() => {
    if (draft === null) return
    setActive(null)
    useChat.getState().setConversationDraft('__new__', draft)
    setDraft(null)
  }, [draft, setDraft, setActive])

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

            <MessageList key={active?.id ?? '__new__'} conversation={active}>
              <WelcomeState
                mode={currentMode}
                name={user.displayName.split(' ')[0]}
                onPrompt={(prompt) => composer.current?.fill(prompt)}
              />
            </MessageList>
            <ChatStatus conversation={active} />

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
