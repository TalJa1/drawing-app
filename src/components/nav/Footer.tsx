import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { QUOTES } from '@/mocks/quotes'
import { hashString } from '@/lib/random'
import { dayKey } from '@/lib/date'
import { useL } from '@/i18n/useL'
import { BrushDivider } from '../art/Brush'
import { PaintSplatter } from '../art/Splatter'
import { Logo } from './Logo'
import { LanguageSwitch, ThemeToggle } from './Toggles'

export function Footer() {
  const { t } = useTranslation()
  const L = useL()
  const quote = QUOTES[hashString(dayKey()) % QUOTES.length]
  const cols: { title: string; links: [string, string][] }[] = [
    {
      title: t('footer.create'),
      links: [
        ['/practice', t('nav.practice')],
        ['/free-draw', t('nav.freeDraw')],
        ['/chat', t('nav.chat')],
      ],
    },
    {
      title: t('footer.learn'),
      links: [
        ['/learn', t('footer.atlas')],
        ['/learn/color-lab', t('nav.colorLab')],
        ['/learn/glossary', t('footer.glossary')],
        ['/learn/flashcards', t('nav.flashcards')],
        ['/learn/spot-the-style', t('footer.spotStyle')],
      ],
    },
    {
      title: t('footer.you'),
      links: [
        ['/collection', t('nav.collection')],
        ['/achievements', t('nav.achievements')],
        ['/profile', t('nav.profile')],
        ['/styleguide', t('footer.styleguide')],
      ],
    },
  ]
  return (
    <footer className="relative mt-10 overflow-hidden pb-28 pt-10 md:pb-12">
      <div className="container-art">
        <BrushDivider />
        <div className="mt-10 grid gap-12 md:grid-cols-[1.3fr_2fr]">
          <div>
            <Logo />
            <figure className="mt-8 max-w-sm">
              <blockquote className="font-display text-2xl italic leading-snug text-ink">“{L(quote.text)}”</blockquote>
              <figcaption className="hand mt-2 text-xl text-accent-ink">— {quote.by}</figcaption>
            </figure>
            <div className="mt-8 flex items-center gap-2">
              <LanguageSwitch />
              <ThemeToggle />
            </div>
          </div>
          <nav aria-label={t('footer.sitemap')} className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {cols.map((c) => (
              <div key={c.title}>
                <h2 className="eyebrow">{c.title}</h2>
                <ul className="mt-4 space-y-2.5">
                  {c.links.map(([to, label]) => (
                    <li key={to}>
                      <Link to={to} className="text-ink-soft transition-colors hover:text-ink">
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <div className="mt-14 flex flex-col gap-2 border-t border-line pt-6 text-sm text-ink-faint sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} Art Spark · {t('footer.prototype')}
          </p>
          <p className="hand text-lg">{t('footer.madeWith')}</p>
        </div>
      </div>
      <PaintSplatter seed="footer" color="var(--saffron)" className="absolute -bottom-16 -right-10 h-64 w-64 opacity-25" />
    </footer>
  )
}
