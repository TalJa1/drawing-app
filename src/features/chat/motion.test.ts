import { createElement } from 'react'
import { act, cleanup, render } from '@testing-library/react'
import { chatVariants, CHAT_MOTION } from './motion'
import { Muse } from './Muse'
import { installDomStubs } from './test-utils'
import { useSettings } from '@/store/settings'

const animations = vi.hoisted(() => vi.fn())
vi.mock('framer-motion', async (original) => {
  const actual = await original<typeof import('framer-motion')>()
  return {
    ...actual,
    motion: new Proxy(
      {},
      {
        get:
          (_target, tag: string) =>
          ({ animate, transition, initial: _initial, ...props }: Record<string, unknown>) => {
            void _initial
            animations({ tag, animate, transition })
            return createElement(tag, props)
          },
      },
    ),
  }
})
beforeEach(() => {
  installDomStubs()
  useSettings.setState({ motion: 'full' })
  animations.mockClear()
  Object.defineProperty(document, 'hidden', { configurable: true, value: false })
})
afterEach(() => {
  cleanup()
  useSettings.setState({ motion: 'system' })
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
const repeats = () => animations.mock.calls.filter(([props]) => props.transition?.repeat === Infinity)

it('reduced variants contain no transform keys', () => {
  const reduced = chatVariants(true)
  expect(Object.keys(reduced)).toEqual(['prompt', 'bubble', 'card', 'swatch', 'attachment', 'sheet', 'threadSwap', 'scrollButton'])
  expect(JSON.stringify(reduced)).not.toMatch(/"(?:x|y|scale|scaleX|scaleY|rotate|repeat|layout)"/)
  expect(CHAT_MOTION.welcome).toBe(0.425)
  expect(CHAT_MOTION.bubble).toBe(0.21)
})
it('still mascot renders no repeating animation', () => {
  render(createElement(Muse, { still: true }))
  expect(repeats()).toHaveLength(0)
})
it('mascot pauses while the document is hidden', () => {
  render(createElement(Muse, { state: 'thinking' }))
  expect(repeats().length).toBeGreaterThan(0)
  animations.mockClear()
  act(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  expect(animations).toHaveBeenCalled()
  expect(repeats()).toHaveLength(0)
})
it('reduced motion mascot has no loops or transforms', () => {
  useSettings.setState({ motion: 'reduce' })
  render(createElement(Muse, { state: 'speaking' }))
  expect(repeats()).toHaveLength(0)
  for (const [props] of animations.mock.calls) expect(JSON.stringify(props.animate)).not.toMatch(/"(?:x|y|scale|scaleY|rotate)"/)
})
it('error mascot returns to idle after 1.2 seconds', async () => {
  vi.useFakeTimers()
  const view = render(createElement(Muse, { state: 'error' }))
  expect(view.container.querySelector('svg')).toHaveAttribute('data-state', 'error')
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1200)
  })
  expect(view.container.querySelector('svg')).toHaveAttribute('data-state', 'idle')
})
