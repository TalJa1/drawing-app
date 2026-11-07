import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useSettings } from '@/store/settings'

// The chrome around the page is not what is tested here
vi.mock('@/components/nav/Navbar', () => ({ Navbar: () => null }))
vi.mock('@/components/nav/MobileTabBar', () => ({ MobileTabBar: () => null }))
vi.mock('@/components/nav/Footer', () => ({ Footer: () => null }))
vi.mock('@/components/PaintWipe', () => ({ PaintWipe: () => null }))

const { MainLayout } = await import('./MainLayout')

/** A page with one entrance of its own, like most pages have (fade in) and one endless loop (like the art-form wheel). */
function Page() {
  return (
    <>
      <motion.p data-testid="entrance" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        hello
      </motion.p>
      <motion.p data-testid="loop" initial={{ rotate: 0 }} animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 60 }}>
        loop
      </motion.p>
    </>
  )
}

const renderFirstPage = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route element={<MainLayout />}>
          <Route index element={<Page />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )

beforeEach(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }))
})
afterEach(() => {
  vi.unstubAllGlobals()
  useSettings.setState({ motion: 'system' })
})

describe('MainLayout — the page that is on screen when the site is opened', () => {
  it('lets what is inside it play its own entrance (it used to start every motion element at its end state)', () => {
    useSettings.setState({ motion: 'full' })
    renderFirstPage()
    // still at the start of the fade: the first frame has not run yet
    expect(screen.getByTestId('entrance').style.opacity).toBe('0')
  })

  it('does not slide the whole first page in (the splash has just been replaced by it)', () => {
    useSettings.setState({ motion: 'full' })
    const { container } = renderFirstPage()
    const wrapper = container.querySelector('main > div') as HTMLElement
    expect(wrapper.style.opacity).not.toBe('0')
  })

  it('plays nothing on that first page when motion is reduced', () => {
    useSettings.setState({ motion: 'reduce' })
    renderFirstPage()
    expect(screen.getByTestId('entrance').style.opacity).toBe('1')
  })
})
