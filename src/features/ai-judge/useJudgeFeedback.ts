import { useCallback, useEffect, useRef, useState } from 'react'
import type { AiErrorCode, Artwork, Lang, ScoreResult, Template } from '@/types'
import { AiTransportError } from '@/api/ai/errors'
import type { JudgeFeedback } from '@/api/ai/judgeContract'
import { getJudgeTransport } from '@/api/ai/judgeTransport'
import { buildJudgeRequest } from './judgeRequest'

export type JudgeState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; feedback: JudgeFeedback }
  | { status: 'error'; code: AiErrorCode; retryAfterMs?: number }

/** Session-only memory: nothing is written to localStorage or IndexedDB. */
const cache = new Map<string, JudgeFeedback>()

export function clearJudgeCache() {
  cache.clear()
}

export function useJudgeFeedback(artwork: Artwork, template: Template, score: ScoreResult, lang: Lang) {
  const key = `${artwork.id}|${score.scoredAt}|${lang}`
  const [state, setState] = useState<{ key: string; value: JudgeState }>({ key, value: { status: 'idle' } })
  const controller = useRef<AbortController | null>(null)

  useEffect(() => () => controller.current?.abort(), [])

  const request = useCallback(async () => {
    controller.current?.abort()
    const current = new AbortController()
    controller.current = current
    setState({ key, value: { status: 'loading' } })
    try {
      const req = await buildJudgeRequest(artwork, template, score, lang)
      current.signal.throwIfAborted()
      const feedback = await getJudgeTransport().requestFeedback(req, current.signal)
      cache.set(key, feedback)
      if (!current.signal.aborted) setState({ key, value: { status: 'done', feedback } })
    } catch (error) {
      if (current.signal.aborted) return
      setState({
        key,
        value:
          error instanceof AiTransportError
            ? { status: 'error', code: error.code, retryAfterMs: error.retryAfterMs }
            : { status: 'error', code: 'client' },
      })
    }
  }, [artwork, template, score, lang, key])

  const cached = cache.get(key)
  const value: JudgeState = cached ? { status: 'done', feedback: cached } : state.key === key ? state.value : { status: 'idle' }
  return { state: value, request }
}
