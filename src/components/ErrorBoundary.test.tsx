import { fireEvent, render, screen } from '@testing-library/react'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '@/i18n/en.json'
import { ErrorBoundary } from './ErrorBoundary'

vi.mock('@/app/i18n', async () => ({ default: (await import('i18next')).default }))

/*
 * "Try again" on the error screen. A page that could not be fetched (a bad connection, a damaged browser cache, a file
 * that a new release replaced) stays failed inside React for good: React.lazy keeps its first failure and throws it
 * again on every render. So for that kind of failure the only real retry is to load the page again.
 */

const reload = vi.fn()
let broken: Error | null = null

function Page() {
  if (broken) throw broken
  return <p>the page</p>
}
const mount = () =>
  render(
    <ErrorBoundary>
      <Page />
    </ErrorBoundary>,
  )

beforeAll(async () => {
  await i18n.use(initReactI18next).init({ lng: 'en', resources: { en: { translation: en } } })
  vi.spyOn(console, 'error').mockImplementation(() => {}) // React and the boundary log what they catch
})
beforeEach(() => {
  reload.mockReset()
  broken = null
  Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, reload } })
})

describe('ErrorBoundary, Try again', () => {
  it.each([
    ['Chrome, Edge', 'Failed to fetch dynamically imported module: http://localhost:5173/src/pages/free-draw/FreeDrawPage.tsx'],
    ['Firefox', 'error loading dynamically imported module: http://localhost/assets/FreeDrawPage-1a2b3c.js'],
    ['Safari', 'Importing a module script failed.'],
    ['a stylesheet of a page', 'Unable to preload CSS for /assets/FreeDrawPage-1a2b3c.css'],
  ])('loads the page again when a part of the app could not be fetched (%s)', (_browser, message) => {
    broken = new TypeError(message)
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('only clears the error for any other failure: the page is shown again without a reload', () => {
    broken = new Error('Cannot read properties of undefined')
    mount()
    expect(screen.getByRole('alert')).toBeInTheDocument()
    broken = null // what was wrong has been put right
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByText('the page')).toBeInTheDocument()
    expect(reload).not.toHaveBeenCalled()
  })
})
