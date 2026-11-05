import { useTranslation } from 'react-i18next'

export function ChatPrivacy() {
  const { t } = useTranslation()
  return (
    <div className="mt-2 flex items-start gap-2 text-[11px] text-ink-faint">
      <p className="min-w-0 flex-1">{t('chat.disclaimer')}</p>
      <details
        className="relative shrink-0"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.currentTarget.open = false
            event.currentTarget.querySelector('summary')?.focus()
          }
        }}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false
        }}
      >
        <summary className="flex min-h-11 cursor-pointer items-center rounded underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-ink">
          {t('chat.data.learnMore')}
        </summary>
        <div className="absolute bottom-full right-0 z-30 mb-2 w-[min(22rem,calc(100vw-4rem))] space-y-2 rounded-2xl border border-line bg-card p-4 text-sm leading-relaxed text-ink-soft shadow-paper">
          <p>{t('chat.data.training')}</p>
          <p>{t('chat.data.monitoring')}</p>
          <p>{t('chat.data.server')}</p>
          <a
            className="flex min-h-11 items-center underline underline-offset-2"
            href="https://developers.openai.com/api/docs/guides/your-data"
            target="_blank"
            rel="noreferrer"
          >
            {t('chat.data.source')}
          </a>
        </div>
      </details>
    </div>
  )
}
