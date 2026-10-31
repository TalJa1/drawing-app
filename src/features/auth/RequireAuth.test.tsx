import { render, screen } from '@testing-library/react'
import { useState } from 'react'
import { MemoryRouter, Outlet, Route, Routes, useLocation, useOutlet } from 'react-router-dom'
import { GUEST, useSession } from '@/store/session'
import { RequireAuth } from './RequireAuth'
import { loginState, loginTarget } from './loginRedirect'

function Login() {
  const loc = useLocation()
  return <p>login page, from={JSON.stringify((loc.state as { from?: string } | null)?.from)}</p>
}

const mount = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/collection"
          element={
            <RequireAuth>
              <p>the collection</p>
            </RequireAuth>
          }
        />
      </Routes>
    </MemoryRouter>,
  )

beforeEach(() => useSession.setState({ user: GUEST, token: null }))

describe('RequireAuth', () => {
  it('sends a guest to the sign-in page and remembers where they were going', () => {
    mount('/collection?filter=favourites')
    expect(screen.getByText(/login page/)).toHaveTextContent('from="/collection?filter=favourites"')
    expect(screen.queryByText('the collection')).not.toBeInTheDocument()
  })

  it('lets a signed-in user through', () => {
    useSession.setState({ user: { ...GUEST, id: 'u1', isGuest: false }, token: 'tok' })
    mount('/collection')
    expect(screen.getByText('the collection')).toBeInTheDocument()
  })
})

describe('RequireAuth: a layout that keeps the old page on screen while it animates out', () => {
  // the real layout does this: the guarded page stays mounted for a moment after the location has changed
  function KeepsOldPage() {
    const [first] = useState(useOutlet())
    return (
      <>
        <div data-testid="old">{first}</div>
        <Outlet />
      </>
    )
  }

  it('keeps the page the guest was heading for, instead of overwriting it with the sign-in page', () => {
    render(
      <MemoryRouter initialEntries={['/collection?filter=favourites']}>
        <Routes>
          <Route element={<KeepsOldPage />}>
            <Route path="/login" element={<Login />} />
            <Route
              path="/collection"
              element={
                <RequireAuth>
                  <p>the collection</p>
                </RequireAuth>
              }
            />
          </Route>
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByText(/login page/)).toHaveTextContent('from="/collection?filter=favourites"')
  })
})

describe('loginState / loginTarget', () => {
  it('round-trips an inside address', () => {
    expect(loginTarget(loginState('/free-draw'), '/collection')).toBe('/free-draw')
    expect(loginTarget(loginState('/practice/fox?x=1#y'), '/collection')).toBe('/practice/fox?x=1#y')
  })

  it.each([
    ['nothing remembered', null],
    ['no from', {}],
    ['not a string', { from: 42 }],
    ['another site', { from: 'https://evil.example/x' }],
    ['protocol-relative', { from: '//evil.example' }],
    ['backslash trick', { from: '/\\evil.example' }],
    ['a script', { from: 'javascript:alert(1)' }],
    ['not an address at all', { from: 'collection' }],
    ['the sign-in page itself (a loop)', { from: '/login' }],
    ['the sign-up page (a loop)', { from: '/register?x=1' }],
  ])('uses the fallback for %s', (_n, state) => {
    expect(loginTarget(state, '/collection')).toBe('/collection')
  })
})
