import { useTranslation } from 'react-i18next'
import { Brush, Home } from 'lucide-react'
import { Page } from '@/components/Layout'
import { Frame, WallLabel } from '@/components/Frame'
import { ButtonLink } from '@/components/Button'
import { PaintSplatter } from '@/components/art/Splatter'
import { Washes } from '@/components/art/Washes'

/** 404: an empty gallery frame — “This canvas is blank”. */
export default function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <Page>
      <Washes />
      <div className="container-art grid min-h-[60dvh] items-center gap-12 lg:grid-cols-2">
        <div>
          <p className="eyebrow">{t('notFound.eyebrow')}</p>
          <h1 className="display-xl mt-4">
            {t('notFound.titleA')} <em>{t('notFound.titleB')}</em>
          </h1>
          <p className="mt-6 max-w-md text-lg text-ink-soft">{t('notFound.body')}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink to="/free-draw" variant="pigment" icon={<Brush size={17} />}>
              {t('notFound.paint')}
            </ButtonLink>
            <ButtonLink to="/" variant="outline" icon={<Home size={17} />}>
              {t('errors.goHome')}
            </ButtonLink>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-md">
          <Frame frameWidth={16} matWidth={22} tilt={2} label={<WallLabel title={t('notFound.labelTitle')} lines={[t('notFound.labelLine')]} />}>
            <div className="relative aspect-[4/5] bg-white">
              <span className="absolute inset-0 flex items-center justify-center font-display text-[7rem] italic text-ink/[0.06]">404</span>
            </div>
          </Frame>
          <PaintSplatter seed="404" color="var(--vermilion)" className="absolute -bottom-8 -right-8 h-32 w-32 opacity-60" />
          <p className="hand absolute -left-6 -top-8 -rotate-6 text-2xl text-accent-ink">{t('notFound.note')}</p>
        </div>
      </div>
    </Page>
  )
}
