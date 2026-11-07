import { useState } from 'react'
import { Link } from 'react-router-dom'
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
      {/* The ring turns once in 3 minutes and each picture turns back the same way, so the faces stay upright. This is
          CSS (.wheel-turn / .wheel-hold in effects.css) and not a JS animation: it runs on the compositor, so the page's
          main thread is not woken up on every frame for it, and it does not depend on how the page was opened. */}
      <div className={`absolute inset-0 ${reduced ? '' : 'wheel-turn'}`}>
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
            <div
              key={f.slug}
              className={`absolute ${reduced ? '' : 'wheel-hold'}`}
              style={{ left: `${x}%`, top: `${y}%`, translate: '-50% -50%' }}
            >
              {/* The picture sits beside the link, not inside it: a few covers draw a word ("WHOOSH", "ART!") that a
                  checker reads as the link's visible text, and the link is named by the art form, not by that word. */}
              <div
                className={`relative rounded-full border-[3px] shadow-paper transition-[width,height,border-color] duration-300 ${on ? 'h-16 w-16 border-saffron sm:h-20 sm:w-20' : 'h-11 w-11 border-card sm:h-14 sm:w-14'}`}
              >
                {/* the clipping is on this inner box, so the link's focus ring (outside its edge) is not cut off */}
                <div className="h-full w-full overflow-hidden rounded-full">
                  <ArtFormCover style={f.coverStyle} palette={f.palette} seed={f.slug} />
                </div>
                <Link
                  to={`/learn/art-forms/${f.slug}`}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  aria-label={L(f.name)}
                  className="absolute inset-0 rounded-full"
                />
              </div>
            </div>
          )
        })}
      </div>
      <div
        className="absolute inset-[22%] flex flex-col items-center justify-center rounded-full bg-card/80 p-4 text-center shadow-lift"
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
