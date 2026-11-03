import type { ArtworkAnalysis } from '@/types'
import { useProgress } from '@/store/progress'
import en from '@/i18n/en.json'
import vi_ from '@/i18n/vi.json'
import { ApiError } from './client'
import { GUEST, useSession } from '@/store/session'
import {
  deleteArtwork,
  getArtwork,
  acquireImage,
  getImageBlob,
  setImageCacheLimit,
  IMAGE_CACHE_LIMIT_BYTES,
  listArtworks,
  saveArtwork,
  submitArtwork,
  updateArtwork,
  clearImageCache,
  apiErrorKey,
  API_ERROR_CODES,
} from './artworks'

const fetchMock = vi.fn()

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })

const ID = '3f1c2a64-8e1b-4f0e-9a55-0b8d2c1e7a10'
const ID2 = '9a0d4b71-2c3e-4d5f-8a6b-1c2d3e4f5a6b'

const wire = (over: Record<string, unknown> = {}) => ({
  id: ID,
  kind: 'free',
  title: 'Dawn',
  createdAt: '2026-10-31T08:00:00.000000Z',
  updatedAt: '2026-10-31T08:00:00.000000Z',
  timeSpent: 90,
  width: 800,
  height: 600,
  imageKey: `/api/v1/artworks/${ID}/image`,
  thumbKey: `/api/v1/artworks/${ID}/thumb`,
  favourite: false,
  medium: 'Digital',
  ...over,
})

const REWARD = {
  xpGained: 75,
  xpBefore: 0,
  xpAfter: 75,
  levelBefore: 1,
  levelAfter: 1,
  newBadges: ['first-stroke'],
  streak: 1,
  streakExtended: true,
  completedChallenges: [],
}

const call = (n = -1) => {
  const [url, init] = fetchMock.mock.calls.at(n) as [string, RequestInit]
  return { url, init, headers: new Headers(init.headers) }
}

const png = () => new Blob(['PNG'], { type: 'image/png' })
const jpg = () => new Blob(['JPG'], { type: 'image/jpeg' })
const base = { title: 'Dawn', image: png(), thumbnail: jpg(), width: 800, height: 600, timeSpent: 90, medium: 'Digital' }

let urlSeq = 0
const revoke = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  revoke.mockReset()
  urlSeq = 0
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => `blob:test/${++urlSeq}`, revokeObjectURL: revoke }))
  useSession.setState({ user: { ...GUEST, id: 'u1', isGuest: false }, token: 'tok-1' })
  localStorage.removeItem('artspark:collection')
  clearImageCache()
  setImageCacheLimit(IMAGE_CACHE_LIMIT_BYTES)
  revoke.mockReset()
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('saveArtwork', () => {
  it('posts the picture, its thumbnail and the facts as multipart, and nothing else', async () => {
    fetchMock.mockResolvedValue(json(201, wire({ reward: REWARD })))
    await saveArtwork({ ...base, kind: 'free' })
    const { url, init, headers } = call(0) // the first call is the save; a refresh of the numbers follows
    expect(url).toBe('/api/v1/artworks')
    expect(init.method).toBe('POST')
    expect(headers.get('Authorization')).toBe('Bearer tok-1')
    const form = init.body as FormData
    expect(form).toBeInstanceOf(FormData)
    expect([...form.keys()].sort()).toEqual(['image', 'meta', 'thumbnail'])
    expect((form.get('image') as File).type).toBe('image/png')
    expect((form.get('thumbnail') as File).type).toBe('image/jpeg')
    expect(JSON.parse(form.get('meta') as string)).toEqual({
      kind: 'free',
      title: 'Dawn',
      width: 800,
      height: 600,
      timeSpent: 90,
      medium: 'Digital',
    })
  })

  it('sends the template and the measured analysis of a practice drawing', async () => {
    fetchMock.mockResolvedValue(json(201, wire({ kind: 'practice', templateId: 'fox' })))
    // only a few of the measured numbers: this test is about what is sent, not about what is measured
    const analysis = { coverage: 0.8, spill: 0.02, distinctHues: 5 } as unknown as ArtworkAnalysis
    await submitArtwork({ ...base, templateId: 'fox', analysis })
    const meta = JSON.parse((call().init.body as FormData).get('meta') as string)
    expect(meta).toMatchObject({ kind: 'practice', templateId: 'fox', analysis })
  })

  it('hands back the artwork without the reward, and the reward apart', async () => {
    fetchMock.mockResolvedValue(json(201, wire({ reward: REWARD })))
    const saved = await saveArtwork({ ...base, kind: 'free' })
    expect(saved.reward).toEqual(REWARD)
    expect(saved.artwork).toMatchObject({ id: ID, kind: 'free', title: 'Dawn' })
    expect('reward' in saved.artwork).toBe(false)
  })

  it("then brings the account's numbers up to date, once", async () => {
    const progress = {
      xp: 75,
      level: { level: 1, current: 75, needed: 200, ratio: 0.4 },
      badges: {},
      streak: { current: 1, longest: 1, lastDay: '2026-10-31', freezes: 1, frozenDays: [], live: 1 },
      activity: {},
      stats: useProgress.getState().stats,
      scoreHistory: [],
    }
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith('/me/progress') ? json(200, progress) : json(201, wire({ reward: REWARD })),
    )
    useProgress.getState().reset()
    await saveArtwork({ ...base, kind: 'free' })
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual(['/api/v1/artworks', '/api/v1/me/progress'])
    expect(useProgress.getState().xp).toBe(75)
  })

  it('does not ask for the numbers when nothing was paid (a practice drawing, or the same picture again)', async () => {
    fetchMock.mockResolvedValue(json(200, wire()))
    await saveArtwork({ ...base, kind: 'free' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('still hands back the artwork and its reward when only that refresh fails', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/me/progress')) throw new TypeError('Failed to fetch')
      return json(201, wire({ reward: REWARD }))
    })
    await expect(saveArtwork({ ...base, kind: 'free' })).resolves.toMatchObject({ reward: REWARD, artwork: { id: ID } })
  })

  it('has no reward when the server paid nothing (a practice drawing, or the same picture again)', async () => {
    fetchMock.mockResolvedValue(json(200, wire()))
    const saved = await saveArtwork({ ...base, kind: 'free' })
    expect(saved.reward).toBeUndefined()
  })

  it('submitArtwork gives back just the artwork', async () => {
    fetchMock.mockResolvedValue(json(201, wire({ kind: 'practice', templateId: 'fox' })))
    const a = await submitArtwork({ ...base, templateId: 'fox' })
    expect(a).toMatchObject({ id: ID, kind: 'practice', templateId: 'fox' })
  })

  it('passes the server refusal on with its code (a locked template)', async () => {
    fetchMock.mockResolvedValue(json(403, { error: { code: 'template_locked', message: 'Locked' } }))
    await expect(submitArtwork({ ...base, templateId: 'owl' })).rejects.toMatchObject({ status: 403, code: 'template_locked' })
  })

  it('keeps nothing on this device: the account is the only place the picture lives', async () => {
    fetchMock.mockResolvedValue(json(201, wire({ reward: REWARD })))
    await saveArtwork({ ...base, kind: 'free' })
    expect(localStorage.getItem('artspark:collection')).toBeNull() // the old local copy of the collection is never written again
  })
})

describe('listArtworks', () => {
  it('asks for the biggest page and returns it when there is no more', async () => {
    fetchMock.mockResolvedValue(json(200, [wire(), wire({ id: ID2 })]))
    const list = await listArtworks()
    expect(call().url).toBe('/api/v1/artworks?limit=500')
    expect(list.map((a) => a.id)).toEqual([ID, ID2])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('follows X-Next-Cursor until the last page, in order', async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, [wire({ id: 'a' })], { 'X-Next-Cursor': 'c 1/+' }))
      .mockResolvedValueOnce(json(200, [wire({ id: 'b' })], { 'X-Next-Cursor': 'c2' }))
      .mockResolvedValueOnce(json(200, [wire({ id: 'c' })]))
    const list = await listArtworks()
    expect(list.map((a) => a.id)).toEqual(['a', 'b', 'c'])
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      '/api/v1/artworks?limit=500',
      `/api/v1/artworks?limit=500&cursor=${encodeURIComponent('c 1/+')}`,
      '/api/v1/artworks?limit=500&cursor=c2',
    ])
  })

  it('refuses to loop forever on a cursor the server keeps repeating', async () => {
    fetchMock.mockImplementation(async () => json(200, [wire()], { 'X-Next-Cursor': 'same' }))
    await expect(listArtworks()).rejects.toMatchObject({ code: 'server_error' })
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(3)
  })

  it('fails as a whole if any page fails (no half list passed off as the whole)', async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, [wire()], { 'X-Next-Cursor': 'c2' }))
      .mockResolvedValueOnce(json(503, { error: { code: 'service_unavailable', message: 'Try later' } }))
    await expect(listArtworks()).rejects.toMatchObject({ status: 503 })
  })

  it('is empty for a new account', async () => {
    fetchMock.mockResolvedValue(json(200, []))
    expect(await listArtworks()).toEqual([])
  })
})

describe('getArtwork / updateArtwork / deleteArtwork', () => {
  it('reads one artwork', async () => {
    fetchMock.mockResolvedValue(json(200, wire()))
    const a = await getArtwork(ID)
    expect(call().url).toBe(`/api/v1/artworks/${ID}`)
    expect(a.id).toBe(ID)
  })

  it('tells the server only what changed', async () => {
    fetchMock.mockResolvedValue(json(200, wire({ favourite: true })))
    const a = await updateArtwork(ID, { favourite: true })
    const { url, init } = call()
    expect(url).toBe(`/api/v1/artworks/${ID}`)
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body as string)).toEqual({ favourite: true })
    expect(a.favourite).toBe(true)
  })

  it('renames', async () => {
    fetchMock.mockResolvedValue(json(200, wire({ title: 'New' })))
    await updateArtwork(ID, { title: 'New' })
    expect(JSON.parse(call().init.body as string)).toEqual({ title: 'New' })
  })

  it('deletes, and lets go of the pictures it had loaded', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('PNG', { headers: { 'Content-Type': 'image/png' } }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    const lease = await acquireImage(`/api/v1/artworks/${ID}/image`)
    expect(lease?.url).toBe('blob:test/1')
    await deleteArtwork(ID)
    expect(call().init.method).toBe('DELETE')
    expect(call().url).toBe(`/api/v1/artworks/${ID}`)
    expect(revoke).toHaveBeenCalledWith('blob:test/1')
  })

  it('does not forget the pictures when the delete failed', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('PNG', { headers: { 'Content-Type': 'image/png' } }))
      .mockResolvedValueOnce(json(500, { error: { code: 'internal_error', message: 'x' } }))
    await acquireImage(`/api/v1/artworks/${ID}/image`)
    await deleteArtwork(ID).catch(() => {})
    expect(revoke).not.toHaveBeenCalled()
  })
})

describe('pictures (they need the token, so they are fetched and shown from an object URL)', () => {
  const img = () => new Response('PNG', { status: 200, headers: { 'Content-Type': 'image/png' } })
  const KEY = `/api/v1/artworks/${ID}/thumb`

  it('fetches with the token and returns a blob: URL', async () => {
    fetchMock.mockResolvedValue(img())
    const lease = await acquireImage(KEY)
    expect(lease?.url).toMatch(/^blob:/)
    expect(call().url).toBe(KEY)
    expect(call().headers.get('Authorization')).toBe('Bearer tok-1')
  })

  it('asks the server once per picture, even when two places want it at the same moment', async () => {
    fetchMock.mockImplementation(async () => img())
    const [a, b] = await Promise.all([acquireImage(KEY), acquireImage(KEY)])
    const c = await acquireImage(KEY)
    expect(new Set([a?.url, b?.url, c?.url]).size).toBe(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('gives the bytes for a download, from the same fetch', async () => {
    fetchMock.mockImplementation(async () => img())
    await acquireImage(`/api/v1/artworks/${ID}/image`)
    const blob = await getImageBlob(`/api/v1/artworks/${ID}/image`)
    expect(await blob?.text()).toBe('PNG')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['a key from the old local store', 'img:art_1'],
    ['an address on another site', 'https://evil.example/api/v1/artworks/x/image'],
    ['a path that climbs out', '/api/v1/artworks/../me/progress'],
    ['another endpoint', '/api/v1/me/progress'],
    ['not an artwork id', '/api/v1/artworks/not-an-id/image'],
    ['an empty key', ''],
  ])('never sends the token to %s', async (_n, key) => {
    expect(await acquireImage(key)).toBeNull()
    expect(await getImageBlob(key)).toBeUndefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not remember a failure: the next look tries again', async () => {
    fetchMock.mockResolvedValueOnce(json(404, { error: { code: 'not_found', message: 'gone' } })).mockResolvedValueOnce(img())
    await expect(acquireImage(KEY)).rejects.toMatchObject({ status: 404 })
    await expect(acquireImage(KEY)).resolves.toMatchObject({ url: expect.stringMatching(/^blob:/) })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('lets go of every picture when the user signs out', async () => {
    fetchMock.mockImplementation(async () => img())
    await acquireImage(KEY)
    await acquireImage(`/api/v1/artworks/${ID2}/thumb`)
    useSession.setState({ user: GUEST, token: null })
    expect(revoke).toHaveBeenCalledTimes(2)
    fetchMock.mockClear()
    useSession.setState({ user: { ...GUEST, id: 'u2', isGuest: false }, token: 'tok-2' })
    await acquireImage(KEY) // a different person: nothing of the first one is reused
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not hand a picture to the next person when the first one signed out while it was loading', async () => {
    let answer!: (r: Response) => void
    fetchMock.mockReturnValueOnce(new Promise<Response>((r) => (answer = r)))
    const pending = acquireImage(KEY)
    useSession.setState({ user: GUEST, token: null })
    answer(img())
    expect(await pending).toBeNull()
  })
})

describe('the pictures kept in memory have a ceiling', () => {
  // every picture here weighs 1000 bytes; the ceiling is set in whole pictures to keep the numbers readable
  const pic = (n: number) => `/api/v1/artworks/0000000${n}-8e1b-4f0e-9a55-0b8d2c1e7a10/thumb`
  const body = () => new Response('x'.repeat(1000), { status: 200, headers: { 'Content-Type': 'image/jpeg' } })
  const look = async (n: number) => {
    const lease = await acquireImage(pic(n))
    lease?.release()
    return lease
  }
  const fetched = () => fetchMock.mock.calls.map((c) => c[0] as string)

  beforeEach(() => fetchMock.mockImplementation(async () => body()))

  it('has a ceiling that is a real number of bytes, and the app starts with it', () => {
    expect(IMAGE_CACHE_LIMIT_BYTES).toBeGreaterThan(1024 * 1024)
    expect(Number.isFinite(IMAGE_CACHE_LIMIT_BYTES)).toBe(true)
  })

  it('keeps no more than the ceiling of pictures nobody is looking at, and drops the oldest first', async () => {
    setImageCacheLimit(2500)
    for (const n of [1, 2, 3, 4]) await look(n)
    expect(revoke).toHaveBeenCalledTimes(2) // 4 x 1000 bytes against 2500: two must go
    fetchMock.mockClear()
    await look(4)
    await look(3)
    expect(fetchMock).not.toHaveBeenCalled() // the two newest are still held
    await look(1)
    expect(fetched()).toEqual([pic(1)]) // the oldest was let go, so it is fetched again
  })

  it('keeps pictures that add up to exactly the ceiling', async () => {
    setImageCacheLimit(2000)
    await look(1)
    await look(2)
    expect(revoke).not.toHaveBeenCalled()
    await look(3) // one over
    expect(revoke).toHaveBeenCalledTimes(1)
  })

  it('lets go at once when the ceiling is lowered below what is held', async () => {
    await look(1)
    await look(2)
    await look(3)
    expect(revoke).not.toHaveBeenCalled()
    setImageCacheLimit(1500)
    expect(revoke).toHaveBeenCalledTimes(2)
  })

  it('lets go of the one looked at longest ago, not the one loaded first', async () => {
    setImageCacheLimit(2500)
    await look(1)
    await look(2)
    await look(1) // 1 is looked at again: now 2 is the one nobody has wanted for longest
    await look(3)
    fetchMock.mockClear()
    await look(1)
    expect(fetchMock).not.toHaveBeenCalled()
    await look(2)
    expect(fetched()).toEqual([pic(2)])
  })

  it('never lets go of a picture that is on screen, even over the ceiling', async () => {
    setImageCacheLimit(1500)
    const a = await acquireImage(pic(1))
    const b = await acquireImage(pic(2))
    const c = await acquireImage(pic(3))
    expect(revoke).not.toHaveBeenCalled()
    expect([a, b, c].every((l) => l?.url.startsWith('blob:'))).toBe(true)
    a?.release()
    expect(revoke).toHaveBeenCalledTimes(1) // only once nobody shows it, and only the one released
    expect(revoke).toHaveBeenCalledWith(a?.url)
  })

  it('serves a picture bigger than the ceiling while it is shown, and drops it afterwards', async () => {
    setImageCacheLimit(500)
    const lease = await acquireImage(pic(1))
    expect(lease?.url).toMatch(/^blob:/)
    expect(revoke).not.toHaveBeenCalled()
    lease?.release()
    expect(revoke).toHaveBeenCalledWith(lease?.url)
  })

  it('keeps a picture while any one of the places showing it still holds it', async () => {
    setImageCacheLimit(500)
    const first = await acquireImage(pic(1))
    const second = await acquireImage(pic(1))
    expect(second?.url).toBe(first?.url)
    first?.release()
    first?.release() // letting go twice must not count as the other place letting go
    await look(2) // pressure on the cache
    expect(revoke).not.toHaveBeenCalledWith(first?.url)
    second?.release()
    expect(revoke).toHaveBeenCalledWith(first?.url)
  })

  it('does not count a picture that is still loading as something it can drop', async () => {
    setImageCacheLimit(500)
    let answer!: (r: Response) => void
    fetchMock.mockReturnValueOnce(new Promise<Response>((r) => (answer = r)))
    const pending = acquireImage(pic(1))
    await look(2) // finishes (and is dropped) while picture 1 is still on its way
    answer(body())
    const lease = await pending
    expect(lease?.url).toMatch(/^blob:/)
  })

  it('does not drop a picture that nobody shows yet but is still on its way (a download just started)', async () => {
    setImageCacheLimit(2500)
    let answer!: (r: Response) => void
    fetchMock.mockReturnValueOnce(new Promise<Response>((r) => (answer = r)))
    const download = getImageBlob(pic(1)) // not on screen, so not pinned; its size is not known yet
    for (const n of [2, 3, 4]) await look(n) // 3000 bytes against 2500: the cache must let one go, but not picture 1
    answer(new Response('x'.repeat(100), { status: 200, headers: { 'Content-Type': 'image/jpeg' } }))
    await download
    fetchMock.mockClear()
    const lease = await acquireImage(pic(1)) // it was kept, so this is not fetched a second time
    expect(lease?.url).toMatch(/^blob:/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('stops counting a deleted artwork’s pictures', async () => {
    setImageCacheLimit(2500)
    const id = '00000001-8e1b-4f0e-9a55-0b8d2c1e7a10'
    await look(1)
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    await deleteArtwork(id)
    fetchMock.mockImplementation(async () => body())
    for (const n of [2, 3]) await look(n)
    expect(revoke).toHaveBeenCalledTimes(1) // only the deleted one; 2 + 3 fit in the ceiling
  })

  it('gives bytes for a download without holding a place on screen', async () => {
    setImageCacheLimit(500)
    const blob = await getImageBlob(pic(1))
    expect(blob?.size).toBe(1000)
    expect(revoke).not.toHaveBeenCalled() // no object URL was ever made
  })

  it('counts from zero again after a sign-out', async () => {
    setImageCacheLimit(2500)
    await look(1)
    await look(2)
    useSession.setState({ user: GUEST, token: null })
    useSession.setState({ user: { ...GUEST, id: 'u2', isGuest: false }, token: 'tok-2' })
    revoke.mockClear()
    await look(3)
    await look(4)
    expect(revoke).not.toHaveBeenCalled() // two pictures fit; the first person's two are not in the count
  })
})

describe('apiErrorKey: what the person is told when saving or scoring fails', () => {
  const key = (status: number, code: string) => apiErrorKey(new ApiError('English from the server', status, code))

  it.each([
    'template_locked',
    'rate_limited',
    'payload_too_large',
    'missing_analysis',
    'not_scorable',
    'scoring_not_configured',
    'unauthorized',
  ])('has its own words for %s', (code) => {
    expect(key(400, code)).toBe(`errors.api.${code}`)
  })

  it('treats a dead network and a timeout as the server being out of reach', () => {
    expect(key(0, 'network_error')).toBe('errors.api.network_error')
    expect(key(0, 'timeout')).toBe('errors.api.timeout')
  })

  it('treats a gateway that cannot reach the API (502/503/504, not our envelope) like the server being busy', () => {
    for (const status of [502, 503, 504]) expect(key(status, 'server_error')).toBe('errors.api.service_unavailable')
  })

  it('falls back to the general message for a code it does not know, and for anything that is not an ApiError', () => {
    expect(key(500, 'something_new')).toBe('common.errorGeneric')
    expect(apiErrorKey(new Error('boom'))).toBe('common.errorGeneric')
    expect(apiErrorKey(undefined)).toBe('common.errorGeneric')
  })

  it('never shows the server’s English text', () => {
    expect(key(403, 'template_locked')).not.toMatch(/English/)
  })

  it('has a sentence in both languages for every code it maps', () => {
    for (const code of API_ERROR_CODES) {
      expect((en.errors.api as Record<string, string>)[code], `en ${code}`).toBeTruthy()
      expect((vi_.errors.api as Record<string, string>)[code], `vi ${code}`).toBeTruthy()
    }
  })
})
