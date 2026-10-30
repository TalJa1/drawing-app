import { ApiError } from '@/api/client'
import { shouldRetry } from './queryClient'

const e = (status: number, code = 'x') => new ApiError('m', status, code)

describe('shouldRetry (queries)', () => {
  it('tries once more after a dead network or a timeout', () => {
    expect(shouldRetry(0, e(0, 'network_error'))).toBe(true)
    expect(shouldRetry(0, e(0, 'timeout'))).toBe(true)
  })

  it('tries once more after a server error', () => {
    for (const status of [500, 502, 503, 504]) expect(shouldRetry(0, e(status))).toBe(true)
  })

  it('does not try a second time', () => {
    expect(shouldRetry(1, e(503))).toBe(false)
    expect(shouldRetry(1, e(0, 'network_error'))).toBe(false)
  })

  it('never repeats a request the server refused (4xx): asking again gives the same answer', () => {
    for (const status of [400, 401, 403, 404, 409, 422, 429]) expect(shouldRetry(0, e(status))).toBe(false)
  })

  it('tries once more after an error that is not ours (a bug in a query function)', () => {
    expect(shouldRetry(0, new TypeError('boom'))).toBe(true)
  })
})
