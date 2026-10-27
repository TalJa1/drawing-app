import { useTranslation } from 'react-i18next'
import { ArrowDown } from 'lucide-react'

export function ScrollToLatest({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute bottom-3 left-1/2 z-10 inline-flex min-h-11 -translate-x-1/2 items-center gap-2 rounded-full border border-line bg-card px-4 text-sm shadow-paper"
    >
      <ArrowDown size={16} />
      {t('chat.scrollToLatest')}
    </button>
  )
}
