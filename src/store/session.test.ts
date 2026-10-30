import { GUEST, useSession } from './session'

describe('stored session', () => {
  it('drops a session saved by the old mock login (its token is not a real one)', () => {
    const opts = useSession.persist.getOptions()
    const old = { user: { ...GUEST, id: 'u_1', isGuest: false, displayName: 'Mock' }, token: 'mock.abc.123' }
    expect(opts.version).toBe(2)
    expect(opts.migrate?.(old, 1)).toEqual({ user: GUEST, token: null })
  })
})
