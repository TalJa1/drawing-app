import type { components } from './schema'
import { useSession, GUEST } from '@/store/session'
import { login, logout, register, updateProfile } from './auth'
import { ApiError } from './client'

type UserOut = components['schemas']['UserOut']

const fetchMock = vi.fn()

const USER: UserOut = {
  id: '6f1c2a52-0a3e-4f5e-9d54-0b6f7d3a1c11',
  email: 'lan@example.com',
  displayName: 'Lan',
  bio: '',
  avatarSeed: 'Lan',
  createdAt: '2026-10-30T08:00:00Z',
  isGuest: false,
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const err = (status: number, code: string) => json(status, { error: { code, message: 'x', traceId: 't' } })

function call(i = -1) {
  const [url, init] = fetchMock.mock.calls.at(i) as [string, RequestInit]
  return { url, method: init.method, body: init.body ? JSON.parse(init.body as string) : undefined }
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  useSession.setState({ user: GUEST, token: null })
})
afterEach(() => vi.unstubAllGlobals())

describe('login', () => {
  it('posts the credentials and keeps the user and token the server gave', async () => {
    fetchMock.mockResolvedValue(json(200, { user: USER, token: 'jwt-1' }))
    const out = await login({ email: 'lan@example.com', password: 'secret-pass' })
    expect(call()).toEqual({ url: '/api/v1/auth/login', method: 'POST', body: { email: 'lan@example.com', password: 'secret-pass' } })
    expect(out).toEqual({ user: USER, token: 'jwt-1' })
    expect(useSession.getState()).toMatchObject({ user: USER, token: 'jwt-1' })
  })

  it('leaves the session alone and lets the error through when the password is wrong', async () => {
    fetchMock.mockResolvedValue(err(401, 'invalid_credentials'))
    const e = await login({ email: 'lan@example.com', password: 'wrong-pass' }).catch((x) => x)
    expect(e).toBeInstanceOf(ApiError)
    expect(e).toMatchObject({ status: 401, code: 'invalid_credentials' })
    expect(useSession.getState().user).toEqual(GUEST)
    expect(useSession.getState().token).toBeNull()
  })

  it('never invents a token of its own', async () => {
    fetchMock.mockResolvedValue(json(200, { user: USER, token: 'jwt-1' }))
    await login({ email: 'a@b.co', password: 'whatever-1' })
    expect(useSession.getState().token).not.toMatch(/^mock\./)
  })
})

describe('register', () => {
  it('posts name, email and password and signs the new user in', async () => {
    fetchMock.mockResolvedValue(json(201, { user: USER, token: 'jwt-2' }))
    await register({ displayName: 'Lan', email: 'lan@example.com', password: 'secret-pass' })
    expect(call()).toEqual({
      url: '/api/v1/auth/register',
      method: 'POST',
      body: { displayName: 'Lan', email: 'lan@example.com', password: 'secret-pass' },
    })
    expect(useSession.getState()).toMatchObject({ user: USER, token: 'jwt-2' })
  })

  it('lets email_taken through for the page to explain', async () => {
    fetchMock.mockResolvedValue(err(409, 'email_taken'))
    await expect(register({ displayName: 'Lan', email: 'lan@example.com', password: 'secret-pass' })).rejects.toMatchObject({
      status: 409,
      code: 'email_taken',
    })
    expect(useSession.getState().token).toBeNull()
  })
})

describe('logout', () => {
  it('tells the server, then forgets the user', async () => {
    useSession.setState({ user: USER, token: 'jwt-1' })
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await logout()
    expect(call()).toMatchObject({ url: '/api/v1/auth/logout', method: 'POST' })
    expect(useSession.getState().token).toBeNull()
    expect(useSession.getState().user.isGuest).toBe(true)
  })

  it('forgets the user even when the server cannot be reached', async () => {
    useSession.setState({ user: USER, token: 'jwt-1' })
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(logout()).resolves.toBeUndefined()
    expect(useSession.getState().token).toBeNull()
  })
})

describe('updateProfile', () => {
  it('sends only the changed fields and keeps what the server answers', async () => {
    useSession.setState({ user: USER, token: 'jwt-1' })
    const saved = { ...USER, bio: 'Hello', displayName: 'Lan K' }
    fetchMock.mockResolvedValue(json(200, saved))
    const out = await updateProfile({ bio: 'Hello', displayName: 'Lan K' })
    expect(call()).toEqual({ url: '/api/v1/me', method: 'PATCH', body: { bio: 'Hello', displayName: 'Lan K' } })
    expect(out).toEqual(saved)
    expect(useSession.getState()).toMatchObject({ user: saved, token: 'jwt-1' })
  })

  it('keeps the old profile when the server refuses', async () => {
    useSession.setState({ user: USER, token: 'jwt-1' })
    fetchMock.mockResolvedValue(err(422, 'validation_error'))
    await expect(updateProfile({ displayName: 'L' })).rejects.toMatchObject({ code: 'validation_error' })
    expect(useSession.getState().user).toEqual(USER)
  })

  it('changes a guest locally without calling the server (a guest has no profile there)', async () => {
    const out = await updateProfile({ displayName: 'Mai' })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(out.displayName).toBe('Mai')
    expect(useSession.getState().user.displayName).toBe('Mai')
  })
})
