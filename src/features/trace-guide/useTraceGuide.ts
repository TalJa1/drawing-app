import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { DrawingEngine } from '@/features/drawing/engine/Engine'
import { useLevel } from '@/features/gamification/hooks'
import { loadSvgImage } from '@/lib/raster'
import { useTemplates } from '@/api/queries'
import type { Template } from '@/types'

export const GUIDE_STRENGTHS = { light: 0.18, medium: 0.3, strong: 0.45 } as const
export type GuideStrength = keyof typeof GUIDE_STRENGTHS

export interface TraceGuideLookup {
  /** The unlocked template named by `?guide=`; null while it is loading and when it is absent, unknown, locked or the list failed. */
  guide: Template | null
  /** A guide is asked for and the server's list has not answered yet: the page waits rather than opening plain and then again. */
  loading: boolean
}

/**
 * The guide named by `?guide=`, taken from the template list the server sent (the same one the library shows).
 * The list is only asked for when a guide is named, so an ordinary Free Draw page costs no extra request.
 */
export function useTraceGuide(): TraceGuideLookup {
  const [params] = useSearchParams()
  const { level } = useLevel()
  const id = params.get('guide')
  const { data, isPending } = useTemplates({ enabled: !!id })
  if (!id) return { guide: null, loading: false }
  const template = data?.find((candidate) => candidate.id === id)
  return { guide: template && template.unlockLevel <= level ? template : null, loading: isPending }
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
