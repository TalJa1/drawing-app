import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react'
import { PageLoader } from '@/components/PageLoader'
import HomePage from '@/pages/home/HomePage'
import { pages, type PageKey } from './routes'

type LazyKey = Exclude<PageKey, 'home'>
const LAZY = Object.fromEntries((Object.keys(pages) as LazyKey[]).map((k) => [k, lazy(pages[k])])) as unknown as Record<
  LazyKey,
  LazyExoticComponent<ComponentType>
>

/** The landing page ships in the main bundle (no loader flash, better LCP); the rest are lazy. */
export function LazyPage({ page }: { page: PageKey }) {
  if (page === 'home') return <HomePage />
  const C = LAZY[page]
  return (
    <Suspense fallback={<PageLoader />}>
      <C />
    </Suspense>
  )
}
