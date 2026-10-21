import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react'
import { PageLoader } from '@/components/PageLoader'
import { pages, type PageKey } from './routes'

const LAZY = Object.fromEntries(
  (Object.keys(pages) as PageKey[]).map((k) => [k, lazy(pages[k])]),
) as unknown as Record<PageKey, LazyExoticComponent<ComponentType>>

export function LazyPage({ page }: { page: PageKey }) {
  const C = LAZY[page]
  return (
    <Suspense fallback={<PageLoader />}>
      <C />
    </Suspense>
  )
}
