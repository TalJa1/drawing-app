import { ApiError } from './client'
import { getDailyTemplateId, getTemplate, getTemplates } from './templates'

const fetchMock = vi.fn()
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const notFound = () => json(404, { error: { code: 'not_found', message: 'We could not find what you were looking for.', traceId: 't1' } })

function lastCall() {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit]
  return { url, init }
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe('getTemplates', () => {
  it('asks GET /templates and returns the list as sent', async () => {
    const list = [{ id: 'fox' }, { id: 'cat' }]
    fetchMock.mockResolvedValue(json(200, list))
    expect(await getTemplates()).toEqual(list)
    const { url, init } = lastCall()
    expect(url).toBe('/api/v1/templates')
    expect(init.method).toBe('GET')
    expect(init.body).toBeUndefined()
  })
})

describe('getTemplate', () => {
  it('asks GET /templates/{id}', async () => {
    fetchMock.mockResolvedValue(json(200, { id: 'fox' }))
    expect(await getTemplate('fox')).toEqual({ id: 'fox' })
    expect(lastCall().url).toBe('/api/v1/templates/fox')
  })

  it('escapes the id so it can not change the path', async () => {
    fetchMock.mockResolvedValue(json(200, {}))
    await getTemplate('a/b c?x=1')
    expect(lastCall().url).toBe('/api/v1/templates/a%2Fb%20c%3Fx%3D1')
  })

  it('turns a 404 into an ApiError the pages can recognise', async () => {
    fetchMock.mockResolvedValue(notFound())
    const err = (await getTemplate('nope').catch((e: unknown) => e)) as ApiError
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(err).toBeInstanceOf(ApiError)
    expect([err.status, err.code]).toEqual([404, 'not_found'])
  })
})

describe('getDailyTemplateId', () => {
  it('asks the server for the template of the day and returns just the id', async () => {
    fetchMock.mockResolvedValue(json(200, { templateId: 'vase' }))
    expect(await getDailyTemplateId()).toBe('vase')
    const { url, init } = lastCall()
    // no `date`: the server answers for today in the caller's time zone (the X-Timezone header)
    expect(url).toBe('/api/v1/challenges/daily-template')
    expect(init.method).toBe('GET')
  })

  it('passes a failure on instead of guessing a template', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(getDailyTemplateId()).rejects.toMatchObject({ code: 'network_error' })
  })
})
