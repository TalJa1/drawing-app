import type { AiErrorCode } from '@/types'

export class AiTransportError extends Error {
  code: AiErrorCode
  retryAfterMs?: number

  constructor(code: AiErrorCode, retryAfterMs?: number) {
    super(code)
    this.name = 'AiTransportError'
    this.code = code
    this.retryAfterMs = retryAfterMs
  }
}
