import { Component, type ErrorInfo, type ReactNode } from 'react'
import i18n from '@/app/i18n'
import { PaintSplatter } from './art/Splatter'

interface State {
  error: Error | null
}

/** Styled fallback for render errors ("a spilled paint pot"). */
export class ErrorBoundary extends Component<{ children: ReactNode; compact?: boolean }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // A real build would report this to an error tracker.
    console.error('[ArtSpark] render error', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    const t = i18n.t.bind(i18n)
    return (
      <div
        role="alert"
        className={
          this.props.compact ? 'p-6 text-center' : 'container-art flex min-h-[70dvh] flex-col items-center justify-center py-24 text-center'
        }
      >
        <div className="relative mb-6 h-40 w-40">
          <PaintSplatter seed="oops" color="var(--vermilion)" className="absolute inset-0 opacity-70" />
        </div>
        <h1 className="display-md">{t('errors.boundaryTitle')}</h1>
        <p className="mt-3 max-w-md text-ink-soft">{t('errors.boundaryBody')}</p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            className="h-11 rounded-full bg-ink px-5 font-medium text-paper"
            onClick={() => this.setState({ error: null })}
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
}
