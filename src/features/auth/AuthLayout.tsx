import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { GenerativeArt } from '@/components/art/GenerativeArt'
import { Frame } from '@/components/Frame'
import { Washes } from '@/components/art/Washes'

/** Split layout for sign-in / sign-up: a framed generative painting beside the form. */
export function AuthLayout({ title, lede, children }: { title: ReactNode; lede: string; children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className="relative pb-28 pt-24 md:pt-32">
      <Washes />
      <div className="container-art grid items-center gap-12 lg:grid-cols-2">
        <div className="mx-auto w-full max-w-md">
          <h1 className="display-lg">{title}</h1>
          <p className="mt-4 text-lg text-ink-soft">{lede}</p>
          <div className="mt-8">{children}</div>
        </div>
        <div className="hidden lg:block">
          <div className="relative mx-auto max-w-md">
            <Frame tilt={-2} frameWidth={14} matWidth={18}>
              <div className="aspect-[3/4]">
                <GenerativeArt style="impressionist" seed="auth" aspect="portrait" title={t('auth.artAlt')} />
              </div>
            </Frame>
            <div className="absolute -bottom-10 -left-10 w-48 rotate-[6deg]">
              <Frame tone="light" frameWidth={8} matWidth={8}>
                <div className="aspect-square">
                  <GenerativeArt style="ukiyoe" seed="auth-2" aspect="square" />
                </div>
              </Frame>
            </div>
            <p className="hand absolute -right-6 -top-8 rotate-6 text-2xl text-accent-ink">{t('auth.artNote')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
