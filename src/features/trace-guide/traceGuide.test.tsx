import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { createInstance } from 'i18next'
import en from '@/i18n/en.json'
import type { DrawingEngine } from '@/features/drawing/engine/Engine'
import { loadSvgImage } from '@/lib/raster'
import { TEMPLATE_MAP } from '@/mocks/templates'
import { TraceGuidePanel, TraceGuideToggle } from './TraceGuideControl'
import { GUIDE_STRENGTHS, useTraceGuide, useTraceGuideState } from './useTraceGuide'

vi.mock('@/features/gamification/hooks', () => ({ useLevel: () => ({ level: 2 }) }))
vi.mock('@/lib/raster', () => ({ loadSvgImage: vi.fn(async () => document.createElement('img')) }))

const locked = Object.values(TEMPLATE_MAP).find((template) => template.unlockLevel > 2)!

function routerAt(url: string) {
  return ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
}

function fakeEngine() {
  return { setGuide: vi.fn(), setGuideProps: vi.fn() } as unknown as DrawingEngine & {
    setGuide: ReturnType<typeof vi.fn>
    setGuideProps: ReturnType<typeof vi.fn>
  }
}

afterEach(() => {
  cleanup()
  vi.mocked(loadSvgImage).mockClear()
})

it.each([
  ['/free-draw?guide=cat', 'cat'],
  ['/free-draw?guide=owl&prompt=Owl', 'owl'],
  ['/free-draw?guide=invented', null],
  ['/free-draw?guide=__proto__', null],
  [`/free-draw?guide=${locked.id}`, null],
  ['/free-draw?prompt=Cat', null],
])('%s resolves to the guide %s', (url, id) => {
  const { result } = renderHook(() => useTraceGuide(), { wrapper: routerAt(url) })
  expect(result.current?.id ?? null).toBe(id)
})

it('the guide state draws the template on the engine at medium strength', async () => {
  const { result } = renderHook(() => useTraceGuideState(TEMPLATE_MAP.cat))
  const engine = fakeEngine()
  await act(() => result.current.onEngine(engine))
  expect(loadSvgImage).toHaveBeenCalledWith(TEMPLATE_MAP.cat.svg)
  expect(engine.setGuide).toHaveBeenCalledWith(expect.any(HTMLImageElement))
  expect(engine.setGuideProps).toHaveBeenLastCalledWith({ visible: true, opacity: GUIDE_STRENGTHS.medium })
  act(() => result.current.setStrength('strong'))
  expect(engine.setGuideProps).toHaveBeenLastCalledWith({ visible: true, opacity: 0.45 })
  act(() => result.current.setVisible(false))
  expect(engine.setGuideProps).toHaveBeenLastCalledWith({ visible: false, opacity: 0.45 })
})

it('a guide that finishes loading after the engine changed is not drawn on the old engine', async () => {
  let finish: (image: HTMLImageElement) => void = () => {}
  vi.mocked(loadSvgImage).mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)))
  const { result } = renderHook(() => useTraceGuideState(TEMPLATE_MAP.cat))
  const first = fakeEngine()
  const second = fakeEngine()
  let pending!: Promise<void>
  act(() => {
    pending = result.current.onEngine(first)
  })
  await act(() => result.current.onEngine(second))
  finish(document.createElement('img'))
  await act(() => pending)
  expect(first.setGuide).not.toHaveBeenCalled()
  expect(second.setGuide).toHaveBeenCalledTimes(1)
})

it('a guide that fails to load leaves a plain page instead of blocking the studio', async () => {
  vi.mocked(loadSvgImage).mockRejectedValueOnce(new Error('broken svg'))
  const { result } = renderHook(() => useTraceGuideState(TEMPLATE_MAP.cat))
  const engine = fakeEngine()
  await expect(act(() => result.current.onEngine(engine))).resolves.toBeUndefined()
  expect(engine.setGuide).toHaveBeenLastCalledWith(null)
})

it('the strengths match the agreed opacities', () => {
  expect(GUIDE_STRENGTHS).toEqual({ light: 0.18, medium: 0.3, strong: 0.45 })
})

async function renderControls() {
  const i18n = createInstance()
  await i18n.use(initReactI18next).init({ lng: 'en', resources: { en: { translation: en } }, interpolation: { escapeValue: false } })
  function Harness() {
    const state = useTraceGuideState(TEMPLATE_MAP.cat)
    return (
      <>
        <TraceGuideToggle state={state} />
        <TraceGuidePanel template={TEMPLATE_MAP.cat} state={state} />
      </>
    )
  }
  render(
    <I18nextProvider i18n={i18n}>
      <Harness />
    </I18nextProvider>,
  )
}

it('the controls default to on and medium, and turning the guide off disables the strengths', async () => {
  await renderControls()
  const toggles = screen.getAllByRole('button', { name: 'Trace guide' })
  expect(toggles).toHaveLength(2)
  for (const toggle of toggles) expect(toggle).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Medium' })).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(screen.getByRole('button', { name: 'Light' }))
  expect(screen.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Medium' })).toHaveAttribute('aria-pressed', 'false')
  fireEvent.click(toggles[0])
  for (const toggle of screen.getAllByRole('button', { name: 'Trace guide' })) expect(toggle).toHaveAttribute('aria-pressed', 'false')
  expect(screen.getByRole('button', { name: 'Strong' })).toBeDisabled()
  expect(screen.getByRole('group', { name: 'Guide strength' })).toBeInTheDocument()
  expect(screen.getByText('Guide: Curious Cat')).toBeInTheDocument()
})
