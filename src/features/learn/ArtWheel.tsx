import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import type { ArtForm } from '@/types'
import { useL } from '@/i18n/useL'
import { useReducedMotion } from '@/app/theme'
import { ArtFormCover } from './ArtFormCover'

/** Interactive constellation of art forms orbiting a centre that describes the one you hover. */
export function ArtWheel({ forms }: { forms: ArtForm[] }) {
  const { t } = useTranslation()
  const L = useL()
  const reduced = useReducedMotion()
  const [active, setActive] = useState(0)
  const n = forms.length
  const sel = forms[active]
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[560px]">
      <motion.div
        className="absolute inset-0"
        animate={reduced ? undefined : { rotate: 360 }}
        transition={{ duration: 180, repeat: Infinity, ease: 'linear' }}
      >
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
          <circle cx="50" cy="50" r="41" fill="none" stroke="var(--line-strong)" strokeDasharray="0.6 1.4" />
          <circle cx="50" cy="50" r="28" fill="none" stroke="var(--line)" />
        </svg>
        {forms.map((f, i) => {
          const a = (i / n) * Math.PI * 2 - Math.PI / 2
          const x = 50 + Math.cos(a) * 41
          const y = 50 + Math.sin(a) * 41
          const on = i === active
          return (
            <motion.div
              key={f.slug}
              className="absolute"
              style={{ left: `${x}%`, top: `${y}%`, x: '-50%', y: '-50%' }}
              animate={reduced ? undefined : { rotate: -360 }}
              transition={{ duration: 180, repeat: Infinity, ease: 'linear' }}
            >
              <Link
                to={`/learn/art-forms/${f.slug}`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                aria-label={L(f.name)}
                className={`block overflow-hidden rounded-full border-[3px] shadow-paper transition-all duration-300 ${on ? 'h-16 w-16 border-saffron sm:h-20 sm:w-20' : 'h-11 w-11 border-card sm:h-14 sm:w-14'}`}
              >
                <ArtFormCover style={f.coverStyle} palette={f.palette} seed={f.slug} />
              </Link>
            </motion.div>
          )
        })}
      </motion.div>
      <div
        className="absolute inset-[22%] flex flex-col items-center justify-center rounded-full bg-card/80 p-4 text-center shadow-lift backdrop-blur"
        aria-live="polite"
      >
        <p className="eyebrow">{t('learn.wheel.artForm', { n: active + 1, total: n })}</p>
        <p className="mt-2 font-display text-2xl leading-tight sm:text-3xl">{L(sel.name)}</p>
        <p className="mt-2 line-clamp-3 text-xs text-ink-soft sm:text-sm">{L(sel.definition)}</p>
        <Link to={`/learn/art-forms/${sel.slug}`} className="link-ink mt-2 text-sm">
          {t('learn.wheel.explore')}
        </Link>
      </div>
    </div>
  )
}
