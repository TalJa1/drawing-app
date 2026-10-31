import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion'
import type { Difficulty, TemplateCategory } from '@/types'
import { Page, SectionHeading, EmptyState } from '@/components/Layout'
import { Chip } from '@/components/Chip'
import { SearchBar, Select, Switch } from '@/components/Form'
import { Skeleton } from '@/components/Progress'
import { Highlight } from '@/components/art/Brush'
import { Washes } from '@/components/art/Washes'
import { Button } from '@/components/Button'
import { useArtworks, useDailyTemplateQuery, useTemplates } from '@/api/queries'
import { TEMPLATE_CATEGORIES } from '@/mocks/templates'
import { fuzzyIncludes } from '@/lib/utils'
import { useLevel } from '@/features/gamification/hooks'
import { TemplateCard } from '@/features/practice/TemplateCard'
import { DailyChallengeBanner } from '@/features/practice/DailyChallengeBanner'
import { useBestScores } from '@/features/practice/useBestScores'
import { DIFF_LEVEL, DIFF_ORDER } from '@/features/practice/constants'
import { dayKey } from '@/lib/date'

type Sort = 'new' | 'popular' | 'easiest'

export default function PracticeLibraryPage() {
  const { t } = useTranslation()
  const { data: templates, isLoading, isError, refetch } = useTemplates()
  const best = useBestScores()
  const { level } = useLevel()
  const [category, setCategory] = useState<TemplateCategory | 'all'>('all')
  const [difficulty, setDifficulty] = useState<Difficulty | 'all'>('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<Sort>('popular')
  const [notDone, setNotDone] = useState(false)
  const dailyQuery = useDailyTemplateQuery()
  const dailyId = dailyQuery.data
  const daily = dailyId ? templates?.find((x) => x.id === dailyId) : undefined
  const { data: artworks } = useArtworks()
  const today = dayKey()
  const dailyDone = (artworks ?? []).some((a) => a.templateId === dailyId && !!a.score && dayKey(new Date(a.score.scoredAt)) === today)

  const list = useMemo(() => {
    let l = templates ?? []
    if (category !== 'all') l = l.filter((x) => x.category === category)
    if (difficulty !== 'all') l = l.filter((x) => x.difficulty === difficulty)
    if (notDone) l = l.filter((x) => best[x.id] === undefined)
    if (query.trim())
      l = l.filter(
        (x) =>
          fuzzyIncludes(x.title.en, query) ||
          fuzzyIncludes(x.title.vi, query) ||
          x.tags.some((tag) => fuzzyIncludes(tag, query)) ||
          fuzzyIncludes(t(`practice.categories.${x.category}`), query),
      )
    const sorted = [...l]
    if (sort === 'new') sorted.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    if (sort === 'popular') sorted.sort((a, b) => b.popularity - a.popularity)
    if (sort === 'easiest') sorted.sort((a, b) => DIFF_LEVEL[a.difficulty] - DIFF_LEVEL[b.difficulty] || a.minutes - b.minutes)
    return sorted
  }, [templates, category, difficulty, notDone, query, sort, best, t])

  const reset = () => {
    setCategory('all')
    setDifficulty('all')
    setQuery('')
    setNotDone(false)
  }

  return (
    <Page>
      <Washes
        washes={[
          { color: 'var(--saffron)', size: '36vmax', top: '-14%', right: '-12%' },
          { color: 'var(--cerulean)', size: '28vmax', top: '40%', left: '-14%', delay: -10 },
        ]}
      />
      <div className="container-art">
        <SectionHeading
          index="01"
          eyebrow={t('practice.eyebrow')}
          title={
            <>
              {t('practice.titleA')} <Highlight>{t('practice.titleB')}</Highlight> <em>{t('practice.titleC')}</em>
            </>
          }
          lede={t('practice.lede')}
          note={t('practice.note', { level })}
        />

        <div className="mt-10">
          {daily ? (
            <DailyChallengeBanner template={daily} done={dailyDone} />
          ) : isLoading || dailyQuery.isPending ? (
            <Skeleton className="h-72 rounded-[30px]" />
          ) : null}
        </div>

        {/* ---------- filters ---------- */}
        <div className="sticky top-[76px] z-30 mt-12 rounded-[26px] border border-line bg-card/85 p-3 shadow-paper backdrop-blur-xl md:top-[92px] md:p-4">
          <LayoutGroup id="cat">
            <div
              className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
              role="group"
              aria-label={t('practice.filters.category')}
            >
              <Chip selected={category === 'all'} onClick={() => setCategory('all')} layoutGroup="cat">
                {t('common.all')}
              </Chip>
              {TEMPLATE_CATEGORIES.map((c) => (
                <Chip key={c} selected={category === c} onClick={() => setCategory(c)} layoutGroup="cat">
                  {t(`practice.categories.${c}`)}
                </Chip>
              ))}
            </div>
          </LayoutGroup>
          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto_auto_auto] md:items-center">
            <SearchBar
              value={query}
              onChange={setQuery}
              label={t('practice.filters.search')}
              placeholder={t('practice.filters.searchPlaceholder')}
            />
            <LayoutGroup id="diff">
              <div className="no-scrollbar flex gap-1.5 overflow-x-auto" role="group" aria-label={t('practice.filters.difficulty')}>
                {(['all', ...DIFF_ORDER] as const).map((d) => (
                  <Chip
                    key={d}
                    selected={difficulty === d}
                    onClick={() => setDifficulty(d)}
                    layoutGroup="diff"
                    className="!h-8 !px-3 !text-xs"
                  >
                    {d === 'all' ? t('practice.filters.anyLevel') : t(`difficulty.${d}`)}
                  </Chip>
                ))}
              </div>
            </LayoutGroup>
            <Select label={t('common.sortBy')} hideLabel value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="md:w-40">
              <option value="popular">{t('practice.sort.popular')}</option>
              <option value="new">{t('practice.sort.new')}</option>
              <option value="easiest">{t('practice.sort.easiest')}</option>
            </Select>
            <Switch
              checked={notDone}
              onChange={setNotDone}
              label={<span className="text-sm">{t('practice.filters.notDone')}</span>}
              className="md:min-w-[200px]"
            />
          </div>
        </div>

        <p className="mt-6 text-sm text-ink-faint" aria-live="polite">
          {t('practice.count', { count: list.length })}
        </p>

        {isError ? (
          <EmptyState title={t('common.errorGeneric')} action={<Button onClick={() => void refetch()}>{t('common.retry')}</Button>} />
        ) : isLoading ? (
          <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="aspect-[4/4.4] rounded-[22px]" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            title={t('practice.empty.title')}
            body={t('practice.empty.body')}
            note={t('practice.empty.note')}
            action={
              <Button variant="outline" onClick={reset}>
                {t('practice.empty.reset')}
              </Button>
            }
          />
        ) : (
          <motion.ul layout className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <AnimatePresence mode="popLayout" initial={false}>
              {list.map((tpl) => (
                <motion.li
                  key={tpl.id}
                  layout
                  initial={{ opacity: 0, scale: 0.94, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 28 }}
                >
                  <TemplateCard template={tpl} best={best[tpl.id]} locked={tpl.unlockLevel > level} isDaily={tpl.id === dailyId} />
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
        )}
      </div>
    </Page>
  )
}
