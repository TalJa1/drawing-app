/* ------------------------------------------------------------------
   The fake "server". Every mock endpoint awaits `simulate()` so the UI
   experiences real latency and (optionally) real failures.
   To connect a back-end, replace the bodies in src/api/*.ts with fetch()
   calls — signatures and return types stay the same.
   ------------------------------------------------------------------ */
import { sleep } from '@/lib/utils'
import { useSettings } from '@/store/settings'

export class ApiError extends Error {
  status: number
  code: string
  constructor(message: string, status = 500, code = 'server_error') {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export interface SimulateOptions {
  /** [min, max] latency in ms (default 300–1500, as a real network would vary) */
  latency?: [number, number]
  /** set false for endpoints that should never randomly fail (e.g. local saves) */
  canFail?: boolean
}

/** Latency + configurable random failure. */
export async function simulate({ latency = [300, 1500], canFail = true }: SimulateOptions = {}) {
  const [min, max] = latency
  await sleep(min + Math.random() * (max - min))
  if (canFail && useSettings.getState().simulateErrors && Math.random() < 0.2) {
    throw new ApiError('The studio lights flickered. Please try again.', 503, 'simulated_failure')
  }
}

/** Placeholder base URL for when the real API arrives. */
export const API_BASE = import.meta.env.VITE_API_BASE ?? '/api'
