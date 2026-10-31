import { GUEST, useSession } from './session'

describe('stored session', () => {
  it('drops a session saved by the old mock login (its token is not a real one)', () => {
    const opts = useSession.persist.getOptions()
    const old = { user: { ...GUEST, id: 'u_1', isGuest: false, displayName: 'Mock' }, token: 'mock.abc.123' }
    expect(opts.version).toBe(2)
    expect(opts.migrate?.(old, 1)).toEqual({ user: GUEST, token: null })
  })
})

describe('signOut', () => {
  it('goes back to the plain guest: no name, avatar or bio of the account that left', () => {
    useSession.setState({
      user: { ...GUEST, id: 'u1', email: 'lan@example.com', isGuest: false, displayName: 'Lan', bio: 'Hi', avatarSeed: 'lan-seed' },
      token: 'tok-123',
    })
    useSession.getState().signOut()
    expect(useSession.getState().user).toEqual(GUEST)
    expect(useSession.getState().token).toBeNull()
  })
})
