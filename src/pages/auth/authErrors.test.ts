import { ApiError } from '@/api/client'
import { authErrorKey } from './authErrors'

const e = (status: number, code: string) => new ApiError('English text from the server', status, code)

describe('authErrorKey', () => {
  it('explains each failure the sign-in and sign-up forms can meet', () => {
    expect(authErrorKey(e(401, 'invalid_credentials'))).toBe('auth.errors.invalid')
    expect(authErrorKey(e(409, 'email_taken'))).toBe('auth.errors.emailTaken')
    expect(authErrorKey(e(429, 'rate_limited'))).toBe('auth.errors.rateLimited')
    expect(authErrorKey(e(0, 'network_error'))).toBe('auth.errors.offline')
    expect(authErrorKey(e(0, 'timeout'))).toBe('auth.errors.offline')
  })

  it('treats a gateway that cannot reach the server (502/503/504, e.g. the dev proxy with the back-end down) as offline', () => {
    expect(authErrorKey(e(502, 'server_error'))).toBe('auth.errors.offline')
    expect(authErrorKey(e(504, 'server_error'))).toBe('auth.errors.offline')
    expect(authErrorKey(e(503, 'service_unavailable'))).toBe('auth.errors.offline')
  })

  it('falls back to the generic message for anything else', () => {
    expect(authErrorKey(e(500, 'server_error'))).toBe('common.errorGeneric')
    expect(authErrorKey(e(422, 'validation_error'))).toBe('common.errorGeneric')
    expect(authErrorKey(new Error('boom'))).toBe('common.errorGeneric')
    expect(authErrorKey('nope')).toBe('common.errorGeneric')
    expect(authErrorKey(undefined)).toBe('common.errorGeneric')
    expect(authErrorKey(null)).toBe('common.errorGeneric')
  })

  it('goes by the code, not by the status: a 401 that is not a wrong password is not "wrong password"', () => {
    expect(authErrorKey(e(401, 'unauthorized'))).toBe('common.errorGeneric')
  })
})
