import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CustomCursor } from './CustomCursor'
import { useSettings } from '@/store/settings'

/* The brush cursor is started by the first mouse movement, not by the page loading. */

function fakeContext() {
  const gradient = { addColorStop: vi.fn() }
  return new Proxy({} as Record<string, unknown>, {
    get: (t, k: string) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => gradient : (t[k] ?? vi.fn())),
    set: (t, k: string, v) => ((t[k] = v), true),
  }) as unknown as CanvasRenderingContext2D
}
const count = () => document.querySelectorAll('canvas.art-brush-cursor, canvas.art-brush-ink').length
const pointer = (type: string, pointerType: string) => {
  const e = new MouseEvent(type, { clientX: 20, clientY: 20, bubbles: true })
  Object.defineProperty(e, 'pointerType', { value: pointerType })
  window.dispatchEvent(e)
}

beforeEach(() => {
  window.matchMedia = ((q: string) => ({
    matches: false,
    media: q,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => fakeContext() as never)
  vi.stubGlobal('Path2D', class {})
  useSettings.setState({ customCursor: true })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
  document.documentElement.className = ''
})

describe('CustomCursor', () => {
  it('creates nothing while the page loads and nobody has moved a mouse', () => {
    render(<CustomCursor />)
    expect(count()).toBe(0)
    expect(document.documentElement.classList.contains('art-cursor')).toBe(false)
  })

  it('starts on the first mouse movement and shows the sprite at once', () => {
    render(<CustomCursor />)
    act(() => pointer('pointermove', 'mouse'))
    expect(count()).toBe(2)
    expect(document.documentElement.classList.contains('art-cursor')).toBe(true)
  })

  it('a finger does not start it', () => {
    render(<CustomCursor />)
    act(() => pointer('pointermove', 'touch'))
    expect(count()).toBe(0)
  })

  it('starts only once, however many times the mouse moves', () => {
    render(<CustomCursor />)
    act(() => {
      pointer('pointermove', 'mouse')
      pointer('pointermove', 'mouse')
      pointer('pointermove', 'pen')
    })
    expect(count()).toBe(2)
  })

  it('removes everything, and the native cursor comes back, when it unmounts', () => {
    const { unmount } = render(<CustomCursor />)
    act(() => pointer('pointermove', 'mouse'))
    unmount()
    expect(count()).toBe(0)
    expect(document.documentElement.classList.contains('art-cursor')).toBe(false)
    // and a later movement starts nothing (the waiting listener went with it)
    act(() => pointer('pointermove', 'mouse'))
    expect(count()).toBe(0)
  })

  it('does nothing when the setting is off', () => {
    useSettings.setState({ customCursor: false })
    render(<CustomCursor />)
    act(() => pointer('pointermove', 'mouse'))
    expect(count()).toBe(0)
  })
})
