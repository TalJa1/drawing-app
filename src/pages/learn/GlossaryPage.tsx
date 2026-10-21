import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, GalleryVerticalEnd } from 'lucide-react'
import type { GlossaryTerm } from '@/types'
import { Page, SectionHeading } from '@/components/Layout'
import { SearchBar } from '@/components/Form'
import { Chip } from '@/components/Chip'
import { ButtonLink } from '@/components/Button'
import { Skeleton } from '@/components/Progress'
import { useGlossary } from '@/api/queries'
import { recordActivity } from '@/api/progress'
import { useL } from '@/i18n/useL'
import { cn, fuzzyIncludes, normalizeText } from '@/lib/utils'
import { presentReward } from '@/store/ui'

const CATS: (GlossaryTerm['category'] | 'all')[] = ['all', 'colour', 'technique', 'composition', 'material', 'history', 'form']

export default function GlossaryPage() {
  const { t } = useTranslation()
  const L = useL()
  const { data, isLoading } = useGlossary()
  const [params] = useSearchParams()
  const focus = params.get('term')
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<(typeof CATS)[number]>('all')

  useEffect(() => {
    const id = window.setTimeout(() => void recordActivity({ type: 'glossary' }).then(presentReward), 600)
    return () => window.clearTimeout(id)
  }, [])

  useEffect(() => {
    if (!focus || !data) return
    const id = window.setTimeout(
      () => document.getElementById(`term-${focus}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
      200,
    )
    return () => window.clearTimeout(id)
  }, [focus, data])

  const groups = useMemo(() => {
    const list = (data ?? [])
      .filter((g) => cat === 'all' || g.category === cat)
      .filter((g) => !q.trim() || fuzzyIncludes(g.term.en, q) || fuzzyIncludes(g.term.vi, q) || fuzzyIncludes(L(g.definition), q))
      .sort((a, b) => normalizeText(L(a.term)).localeCompare(normalizeText(L(b.term))))
    const map = new Map<string, GlossaryTerm[]>()
    for (const g of list) {
      const letter = normalizeText(L(g.term))[0]?.toUpperCase() ?? '#'
      map.set(letter, [...(map.get(letter) ?? []), g])
    }
    return [...map.entries()]
  }, [data, q, cat, L])

  return (
    <Page>
      <div className="container-art">
        <Link to="/learn#tools" className="inline-flex items-center gap-2 text-sm text-ink-faint hover:text-ink">
          <ArrowLeft size={16} /> {t('learn.backToAtlas')}
        </Link>
        <SectionHeading
          className="mt-6"
          eyebrow={t('learn.glossary.eyebrow')}
          title={
            <>
              {t('learn.glossary.titleA')} <em>{t('learn.glossary.titleB')}</em>
            </>
          }
          lede={t('learn.glossary.lede', { count: data?.length ?? 60 })}
        />
        <div className="sticky top-[76px] z-30 mt-8 space-y-3 rounded-[24px] border border-line bg-card/85 p-3 shadow-paper backdrop-blur-xl md:top-[92px]">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <SearchBar
              className="flex-1"
              value={q}
              onChange={setQ}
              label={t('learn.glossary.search')}
              placeholder={t('learn.glossary.searchPlaceholder')}
            />
            <ButtonLink to="/learn/flashcards" variant="ink" icon={<GalleryVerticalEnd size={16} />}>
              {t('learn.glossary.study')}
            </ButtonLink>
          </div>
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            {CATS.map((c) => (
              <Chip key={c} selected={cat === c} onClick={() => setCat(c)} layoutGroup="gloss" className="!h-8">
                {c === 'all' ? t('common.all') : t(`learn.glossary.cats.${c}`)}
              </Chip>
            ))}
          </div>
          <nav aria-label={t('learn.glossary.az')} className="no-scrollbar flex gap-1 overflow-x-auto">
            {groups.map(([letter]) => (
              <a
                key={letter}
                href={`#letter-${letter}`}
                className="inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1 font-display text-sm text-ink-soft hover:bg-ink/5 hover:text-ink"
              >
                {letter}
              </a>
            ))}
          </nav>
        </div>
        {isLoading ? (
          <Skeleton className="mt-8 h-96" />
        ) : groups.length === 0 ? (
          <p className="py-16 text-center text-ink-faint">{t('learn.noResults')}</p>
        ) : (
          <div className="mt-10 space-y-12">
            {groups.map(([letter, terms]) => (
              <section key={letter} id={`letter-${letter}`} className="scroll-mt-64">
                <h2 className="font-display text-6xl italic text-accent-ink/70">{letter}</h2>
                <dl className="mt-4 grid gap-4 md:grid-cols-2">
                  {terms.map((g) => (
                    <div
                      key={g.id}
                      id={`term-${g.id}`}
                      className={cn(
                        'scroll-mt-64 rounded-2xl border p-5 transition-colors',
                        focus === g.id ? 'border-saffron bg-saffron/10' : 'border-line bg-card',
                      )}
                    >
                      <dt className="flex items-baseline justify-between gap-3">
                        <span className="font-display text-xl">{L(g.term)}</span>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                          {t(`learn.glossary.cats.${g.category}`)}
                        </span>
                      </dt>
                      <dd className="mt-1.5 text-ink-soft">{L(g.definition)}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        )}
      </div>
    </Page>
  )
}
