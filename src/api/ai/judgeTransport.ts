import type { JudgeTransport } from './judgeContract'
import { mockJudgeTransport } from './judgeMockTransport'
import { serverJudgeTransport } from './judgeServerTransport'

/** Same rule as chat: VITE_CHAT_TRANSPORT wins; otherwise dev uses the mock and builds use the server. */
export function getJudgeTransport(): JudgeTransport {
  const mode = import.meta.env.VITE_CHAT_TRANSPORT
  return mode === 'server' || (mode !== 'mock' && import.meta.env.PROD) ? serverJudgeTransport : mockJudgeTransport
}
