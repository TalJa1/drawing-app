import { act, render, screen } from '@testing-library/react'
import { ArtworkImage } from './ArtworkImage'

const acquire = vi.fn()
vi.mock('@/api/artworks', () => ({ acquireImage: (...a: unknown[]) => acquire(...a) }))

const KEY = '/api/v1/artworks/3f1c2a64-8e1b-4f0e-9a55-0b8d2c1e7a10/thumb'
const KEY2 = '/api/v1/artworks/9a0d4b71-2c3e-4d5f-8a6b-1c2d3e4f5a6b/thumb'

/** a stand-in for the browser's IntersectionObserver that lets a test say what is in view */
class FakeObserver {
  static all: FakeObserver[] = []
  target: Element | null = null
  gone = false
  cb: IntersectionObserverCallback
  options: IntersectionObserverInit
  constructor(cb: IntersectionObserverCallback, options: IntersectionObserverInit) {
    this.cb = cb
    this.options = options
    FakeObserver.all.push(this)
  }
  observe(el: Element) {
    this.target = el
  }
  unobserve() {}
  disconnect() {
    this.gone = true
  }
  takeRecords() {
    return []
  }
  say(isIntersecting: boolean) {
    this.cb([{ isIntersecting, target: this.target } as unknown as IntersectionObserverEntry], this as unknown as IntersectionObserver)
  }
}
const nearZone = () => FakeObserver.all.find((o) => o.options.rootMargin?.startsWith('400px') && !o.gone)!
const farZone = () => FakeObserver.all.find((o) => o.options.rootMargin?.startsWith('1600px') && !o.gone)!

let urlSeq = 0
const lease = (url?: string) => {
  const release = vi.fn()
  return { url: url ?? `blob:test/${++urlSeq}`, release }
}
const settle = () => act(async () => {})

beforeEach(() => {
  acquire.mockReset()
  FakeObserver.all = []
  urlSeq = 0
  vi.stubGlobal('IntersectionObserver', FakeObserver)
})
afterEach(() => vi.unstubAllGlobals())

const show = (props: Partial<React.ComponentProps<typeof ArtworkImage>> = {}) =>
  render(<ArtworkImage imageKey={KEY} alt="Dawn" aspect={1.5} {...props} />)

describe('ArtworkImage that is not lazy', () => {
  it('asks for its picture at once and shows it', async () => {
    const l = lease()
    acquire.mockResolvedValue(l)
    show()
    await settle()
    expect(acquire).toHaveBeenCalledWith(KEY)
    expect(screen.getByRole('img', { name: 'Dawn' })).toHaveAttribute('src', l.url)
    expect(FakeObserver.all).toHaveLength(0) // nothing to watch
  })

  it('lets the picture go when it leaves the page', async () => {
    const l = lease()
    acquire.mockResolvedValue(l)
    const { unmount } = show()
    await settle()
    unmount()
    expect(l.release).toHaveBeenCalledTimes(1)
  })

  it('lets a picture that arrives after the card is gone go at once', async () => {
    const l = lease()
    let arrive!: (v: unknown) => void
    acquire.mockReturnValue(new Promise((r) => (arrive = r)))
    const { unmount } = show()
    unmount()
    arrive(l)
    await settle()
    expect(l.release).toHaveBeenCalledTimes(1)
  })

  it('swaps pictures when the key changes: lets the old go, asks for the new', async () => {
    const a = lease()
    const b = lease()
    acquire.mockResolvedValueOnce(a).mockResolvedValueOnce(b)
    const { rerender } = show()
    await settle()
    rerender(<ArtworkImage imageKey={KEY2} alt="Dawn" aspect={1.5} />)
    await settle()
    expect(a.release).toHaveBeenCalledTimes(1)
    expect(acquire).toHaveBeenLastCalledWith(KEY2)
    expect(screen.getByRole('img')).toHaveAttribute('src', b.url)
  })

  it('shows the title instead when the picture cannot be had', async () => {
    acquire.mockRejectedValue(new Error('nope'))
    show()
    await settle()
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.getByText('Dawn')).toBeInTheDocument()
  })

  it('shows the title instead when the key is not ours (null)', async () => {
    acquire.mockResolvedValue(null)
    show()
    await settle()
    expect(screen.getByText('Dawn')).toBeInTheDocument()
  })
})

describe('ArtworkImage that is lazy', () => {
  it('asks for nothing while it is far from the screen', async () => {
    acquire.mockResolvedValue(lease())
    show({ lazy: true })
    act(() => nearZone().say(false)) // the browser reports "not near" as soon as it starts watching
    act(() => farZone().say(false))
    await settle()
    expect(acquire).not.toHaveBeenCalled()
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('asks for its picture once it is near the screen', async () => {
    const l = lease()
    acquire.mockResolvedValue(l)
    show({ lazy: true })
    act(() => nearZone().say(true))
    await settle()
    expect(acquire).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('img')).toHaveAttribute('src', l.url)
  })

  it('keeps the picture while it is only a little way off the screen', async () => {
    const l = lease()
    acquire.mockResolvedValue(l)
    show({ lazy: true })
    act(() => nearZone().say(true))
    await settle()
    act(() => nearZone().say(false)) // out of the near zone, still inside the far one
    await settle()
    expect(l.release).not.toHaveBeenCalled()
    expect(screen.getByRole('img')).toBeInTheDocument()
  })

  it('lets the picture go when it is far off the screen, and brings it back when it returns', async () => {
    const first = lease()
    const second = lease()
    acquire.mockResolvedValueOnce(first).mockResolvedValueOnce(second)
    show({ lazy: true })
    act(() => nearZone().say(true))
    await settle()
    act(() => farZone().say(false))
    await settle()
    expect(first.release).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('img')).toBeNull() // the empty frame stays, so the page does not jump
    act(() => nearZone().say(true))
    await settle()
    expect(acquire).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('img')).toHaveAttribute('src', second.url)
  })

  it('never shows the old address while the picture is on its way back', async () => {
    const first = lease()
    acquire.mockResolvedValueOnce(first).mockReturnValueOnce(new Promise(() => {})) // the second ask never answers
    show({ lazy: true })
    act(() => nearZone().say(true))
    await settle()
    act(() => farZone().say(false))
    act(() => nearZone().say(true))
    await settle()
    expect(screen.queryByRole('img')).toBeNull() // the first address may be revoked by now
  })

  it('keeps the frame the same size whether or not the picture is loaded', async () => {
    acquire.mockResolvedValue(lease())
    const { container } = show({ lazy: true, aspect: 1.5 })
    const frame = container.firstElementChild as HTMLElement
    expect(frame.style.aspectRatio).toMatch(/^1\.5( \/ 1)?$/)
    act(() => nearZone().say(true))
    await settle()
    expect(frame.style.aspectRatio).toMatch(/^1\.5( \/ 1)?$/)
  })

  it('stops watching when it leaves the page', () => {
    const { unmount } = show({ lazy: true })
    unmount()
    expect(FakeObserver.all.length).toBeGreaterThan(0)
    expect(FakeObserver.all.every((o) => o.gone)).toBe(true)
  })

  it('does not wait for a screen it cannot watch: without IntersectionObserver it loads at once', async () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    const l = lease()
    acquire.mockResolvedValue(l)
    show({ lazy: true })
    await settle()
    expect(screen.getByRole('img')).toHaveAttribute('src', l.url)
  })
})
