import { Outlet, ScrollRestoration } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import { GrainOverlay, SvgDefs } from '@/components/art/SvgDefs'
import { Toaster } from '@/components/Toaster'
import { CustomCursor } from '@/components/CustomCursor'
import { CelebrationHost } from '@/features/gamification/CelebrationHost'
import { useDocumentPrefs, useReducedMotion } from './theme'

/** Global chrome shared by every route (both page and studio layouts). */
export function AppShell() {
  useDocumentPrefs()
  const reduced = useReducedMotion()
  return (
    <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>
      <SvgDefs />
      <Outlet />
      <GrainOverlay />
      <Toaster />
      <CelebrationHost />
      <CustomCursor />
      <ScrollRestoration getKey={(loc) => loc.pathname} />
    </MotionConfig>
  )
}
