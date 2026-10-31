import { chatStreamEventSchema } from './contract'

it.each(['upstream', 'timeout', 'model_unavailable', 'rate_limited', 'ai_not_configured'])(
  'accepts the documented SSE error %s',
  (code) => {
    expect(chatStreamEventSchema.safeParse({ type: 'error', code, retryAfterMs: 1000 }).success).toBe(true)
  },
)

it.each([
  'unauthorized',
  'service_unavailable',
  'ai_busy',
  'ai_budget_exceeded',
  'payload_too_large',
  'unsupported_media_type',
  'bad_request',
  'validation_error',
  'network',
  'protocol',
  'client',
  'image_missing',
])('rejects HTTP/client-only code %s in SSE', (code) => {
  expect(chatStreamEventSchema.safeParse({ type: 'error', code }).success).toBe(false)
})
