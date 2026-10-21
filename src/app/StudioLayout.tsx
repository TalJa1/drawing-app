import { Outlet } from 'react-router-dom'
import { ErrorBoundary } from '@/components/ErrorBoundary'

/** Full-bleed layout for the drawing studio (no site nav/footer). */
export function StudioLayout() {
  return (
    <div className="desk relative h-dvh overflow-hidden">
      <ErrorBoundary>
        <Outlet />
      </ErrorBoundary>
    </div>
  )
}
