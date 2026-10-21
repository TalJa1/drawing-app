import { useTranslation } from 'react-i18next'
import { ArrowRight, Sparkles, Timer } from 'lucide-react'
import type { Template } from '@/types'
import { useL } from '@/i18n/useL'
import { useNow } from '@/lib/hooks'
import { formatDuration, msUntilMidnight } from '@/lib/date'
import { ButtonLink } from '@/components/Button'
import { Frame } from '@/components/Frame'
import { Washes } from '@/components/art/Washes'
import { PaintSplatter } from '@/components/art/Splatter'
import { TemplateImage } from './TemplateCard'

export function DailyChallengeBanner({ template, done }: { template: Template; done: boolean }) {
  const { t } = useTranslation()
  const L = useL()
  const now = useNow(1000)
  const left = msUntilMidnight(now) / 1000

  return (
    <section
      aria-labelledby="daily-title"
      className="relative isolate overflow-hidden rounded-[30px] border border-line bg-[#1b1a17] text-[#f6f1e7] shadow-lift"
    >
      <Washes
        className="opacity-80"
        washes={[
          { color: '#F2A93B', size: '38rem', top: '-40%', left: '-10%' },
          { color: '#C93C6B', size: '30rem', bottom: '-50%', right: '10%', delay: -9 },
          { color: '#2F80C4', size: '26rem', top: '-30%', right: '-12%', delay: -4 },
        ]}
      />
      <PaintSplatter seed="daily" color="#F2A93B" className="absolute -right-6 bottom-4 h-40 w-40 opacity-30" />
      <div className="relative grid items-center gap-8 p-6 sm:p-10 md:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#F2A93B]">
            <Sparkles size={14} /> {t('practice.daily.eyebrow')}
          </p>
          <h2 id="daily-title" className="display-md mt-4 text-[#f6f1e7]">
            {t('practice.daily.title', { title: L(template.title) })}
          </h2>
          <p className="mt-3 max-w-md text-[#f6f1e7]/75">{done ? t('practice.daily.done') : t('practice.daily.body')}</p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <ButtonLink to={`/practice/${template.id}`} variant="gold" size="lg" iconRight={<ArrowRight size={18} />}>
              {done ? t('practice.daily.again') : t('practice.daily.cta')}
            </ButtonLink>
            <span className="inline-flex items-center gap-2 text-sm text-[#f6f1e7]/80" aria-live="off">
              <Timer size={16} /> {t('practice.daily.resets', { time: formatDuration(left) })}
            </span>
            <span className="rounded-full border border-[#D4AF37]/60 px-3 py-1 text-sm font-semibold text-[#D4AF37]">
              {t('practice.daily.bonus', { xp: 40 })}
            </span>
          </div>
        </div>
        <div className="mx-auto w-full max-w-sm rotate-[1.5deg]">
          <Frame tone="gold" frameWidth={10} matWidth={12}>
            <div className="aspect-[4/3] p-2">
              <TemplateImage template={template} alt={L(template.title)} />
            </div>
          </Frame>
          <p className="hand mt-3 -rotate-2 text-center text-xl text-[#F2A93B]">{t('practice.daily.note')}</p>
        </div>
      </div>
    </section>
  )
}
