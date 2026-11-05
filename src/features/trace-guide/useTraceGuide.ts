import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { DrawingEngine } from '@/features/drawing/engine/Engine'
import { useLevel } from '@/features/gamification/hooks'
import { loadSvgImage } from '@/lib/raster'
import { TEMPLATE_MAP } from '@/mocks/templates'
import type { Template } from '@/types'

export const GUIDE_STRENGTHS = { light: 0.18, medium: 0.3, strong: 0.45 } as const
export type GuideStrength = keyof typeof GUIDE_STRENGTHS

/** The unlocked catalog template named by `?guide=`; null when it is absent, unknown or locked. */
export function useTraceGuide(): Template | null {
  const [params] = useSearchParams()
  const { level } = useLevel()
  const id = params.get('guide')
  const template = id && Object.hasOwn(TEMPLATE_MAP, id) ? TEMPLATE_MAP[id] : undefined
  return template && template.unlockLevel <= level ? template : null
}

export interface TraceGuideState {
  visible: boolean
  strength: GuideStrength
  setVisible: (visible: boolean) => void
  setStrength: (strength: GuideStrength) => void
  /** Pass to Studio `onEngine`: draws the template as a view-only guide. */
  onEngine: (engine: DrawingEngine) => Promise<void>
}

/** Shown at medium strength by default; never touches layers, history or drafts. */
export function useTraceGuideState(template: Template | null): TraceGuideState {
  const [visible, setVisible] = useState(true)
  const [strength, setStrength] = useState<GuideStrength>('medium')
  const engineRef = useRef<DrawingEngine | null>(null)
  const props = useRef({ visible, opacity: GUIDE_STRENGTHS[strength] })
  useEffect(() => {
    props.current = { visible, opacity: GUIDE_STRENGTHS[strength] }
    engineRef.current?.setGuideProps(props.current)
  }, [visible, strength])
  const onEngine = useCallback(
    async (engine: DrawingEngine) => {
      engineRef.current = engine
      if (!template) {
        engine.setGuide(null)
        return
      }
      try {
        const image = await loadSvgImage(template.svg)
        if (engineRef.current !== engine) return
        engine.setGuide(image)
        engine.setGuideProps(props.current)
      } catch {
        // A guide that cannot load leaves an ordinary blank page.
        engine.setGuide(null)
      }
    },
    [template],
  )
  return { visible, strength, setVisible, setStrength, onEngine }
}
