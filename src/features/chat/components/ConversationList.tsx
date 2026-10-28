import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageCirclePlus, Pencil, Trash2 } from 'lucide-react'
import type { Conversation } from '@/types'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { Modal } from '@/components/Modal'
import { useChat } from '@/store/chat'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/date'
import { groupConversations } from '../grouping'
import { useMuse } from '../useMuse'

export function ConversationList({ onPick }: { onPick?: () => void }) {
  const { t, i18n } = useTranslation()
  const conversations = useChat((s) => s.conversations)
  const activeId = useChat((s) => s.activeId)
  const setActive = useChat((s) => s.setActive)
  const rename = useChat((s) => s.rename)
  const remove = useChat((s) => s.remove)
  const { cancelConversation } = useMuse()
  const groups = groupConversations(conversations, new Date())
  const [editing, setEditing] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<Conversation | null>(null)
  return (
    <div className="flex h-full flex-col">
      <Button
        variant="ink"
        icon={<MessageCirclePlus size={17} />}
        onClick={() => {
          if (activeId) cancelConversation(activeId)
          setActive(null)
          onPick?.()
        }}
      >
        {t('chat.newChat')}
      </Button>
      <p className="eyebrow mt-6 px-1">{t('chat.history')}</p>
      <ul className="mt-2 flex-1 space-y-1 overflow-y-auto scrollbar-thin">
        {conversations.length === 0 && <li className="px-2 py-3 text-sm text-ink-faint">{t('chat.noHistory')}</li>}
        {groups.map((group) => (
          <li key={group.key}>
            <p className="eyebrow px-2 py-3">{t(`chat.groups.${group.key}`)}</p>
            <ul>
              {group.items.map((c) => (
                <li
                  key={c.id}
                  className={cn('group flex items-center gap-1 rounded-xl', c.id === activeId ? 'bg-ink/[0.07]' : 'hover:bg-ink/[0.04]')}
                >
                  {editing === c.id ? (
                    <input
                      autoFocus
                      defaultValue={c.title}
                      aria-label={t('chat.rename')}
                      className="m-1 h-8 flex-1 rounded-lg border border-line-strong bg-card px-2 text-sm"
                      onBlur={(e) => {
                        rename(c.id, e.target.value.trim() || c.title)
                        setEditing(null)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                        if (e.key === 'Escape') setEditing(null)
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      className="min-w-0 flex-1 px-3 py-2 text-left"
                      aria-current={c.id === activeId ? 'true' : undefined}
                      onClick={() => {
                        if (activeId && activeId !== c.id) cancelConversation(activeId)
                        setActive(c.id)
                        onPick?.()
                      }}
                    >
                      <span className="block truncate text-sm font-medium">{c.title || t('chat.untitled')}</span>
                      <span className="block text-[11px] text-ink-faint">
                        {t(`chat.modes.${c.mode}.short`)} · {formatDate(c.updatedAt, i18n.language)}
                      </span>
                    </button>
                  )}
                  <span className="flex shrink-0 opacity-100 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
                    <IconButton size="sm" label={t('chat.rename')} icon={<Pencil size={14} />} onClick={() => setEditing(c.id)} noTooltip />
                    <IconButton size="sm" label={t('chat.delete')} icon={<Trash2 size={14} />} onClick={() => setConfirm(c)} noTooltip />
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <Modal open={!!confirm} onClose={() => setConfirm(null)} title={t('chat.deleteTitle')} description={confirm?.title} size="sm">
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => setConfirm(null)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="pigment"
            className="flex-1"
            onClick={() => {
              if (confirm) {
                cancelConversation(confirm.id)
                remove(confirm.id)
              }
              setConfirm(null)
            }}
          >
            {t('common.delete')}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
