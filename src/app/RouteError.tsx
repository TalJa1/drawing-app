import { isRouteErrorResponse, useRouteError } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PaintSplatter } from '@/components/art/Splatter'

/** Router-level error element (chunk load failures, thrown loaders…). */
export function RouteError() {
  const err = useRouteError()
  const { t } = useTranslation()
  const message = isRouteErrorResponse(err) ? `${err.status} ${err.statusText}` : err instanceof Error ? err.message : ''
  return (
    <div role="alert" className="paper-bg flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <PaintSplatter seed="route-error" color="var(--vermilion)" className="mb-6 h-40 w-40 opacity-70" />
      <h1 className="display-md">{t('errors.boundaryTitle')}</h1>
      <p className="mt-3 max-w-md text-ink-soft">{t('errors.boundaryBody')}</p>
      {message && <p className="mt-2 font-mono text-xs text-ink-faint">{message}</p>}
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="h-11 rounded-full bg-ink px-5 font-medium text-paper"
        >
          {t('errors.tryAgain')}
        </button>
        <a href="/" className="inline-flex h-11 items-center rounded-full border border-line-strong px-5 font-medium">
          {t('errors.goHome')}
        </a>
      </div>
    </div>
  )
}
