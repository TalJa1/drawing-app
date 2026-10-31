import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import en from '@/i18n/en.json'
import { ApiError } from '@/api/client'
import { login, register } from '@/api/auth'
import { syncProgress } from '@/api/progress'
import LoginPage from './LoginPage'
import RegisterPage from './RegisterPage'

vi.mock('@/api/auth', () => ({ login: vi.fn(), register: vi.fn() }))
vi.mock('@/api/progress', () => ({ syncProgress: vi.fn().mockResolvedValue(undefined) }))

beforeAll(async () => {
  await i18n
    .use(initReactI18next)
    .init({ lng: 'en', fallbackLng: 'en', resources: { en: { translation: en } }, interpolation: { escapeValue: false } })
})
beforeEach(() => vi.clearAllMocks())

const fill = (label: RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
const submit = (name: RegExp) => fireEvent.click(screen.getByRole('button', { name }))
const mount = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>)

describe('LoginPage', () => {
  it('asks for 8 characters like the server does (not 6)', async () => {
    mount(<LoginPage />)
    fill(/email/i, 'lan@example.com')
    fill(/password/i, '1234567')
    submit(/sign in/i)
    expect(await screen.findByText(en.auth.errors.passwordShort8)).toBeInTheDocument()
    expect(login).not.toHaveBeenCalled()
  })

  it('tells a wrong password apart, without the old preview tip', async () => {
    vi.mocked(login).mockRejectedValue(new ApiError('Incorrect', 401, 'invalid_credentials'))
    mount(<LoginPage />)
    fill(/email/i, 'lan@example.com')
    fill(/password/i, 'wrong-password')
    submit(/sign in/i)
    expect(await screen.findByRole('alert')).toHaveTextContent(en.auth.errors.invalid)
    expect(screen.getByRole('alert').textContent).not.toMatch(/wrongpass|preview/i)
  })

  it('says so when it is blocked for too many tries, and when the server cannot be reached', async () => {
    vi.mocked(login).mockRejectedValueOnce(new ApiError('Slow', 429, 'rate_limited'))
    mount(<LoginPage />)
    fill(/email/i, 'lan@example.com')
    fill(/password/i, 'long-enough-1')
    submit(/sign in/i)
    expect(await screen.findByRole('alert')).toHaveTextContent(en.auth.errors.rateLimited)
    vi.mocked(login).mockRejectedValueOnce(new ApiError('down', 0, 'network_error'))
    submit(/sign in/i)
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(en.auth.errors.offline))
  })
})

describe('RegisterPage', () => {
  it('explains an email that is already registered', async () => {
    vi.mocked(register).mockRejectedValue(new ApiError('taken', 409, 'email_taken'))
    mount(<RegisterPage />)
    fill(/name/i, 'Lan')
    fill(/email/i, 'lan@example.com')
    fireEvent.change(screen.getAllByLabelText(/password/i)[0], { target: { value: 'long-enough-1' } })
    fireEvent.change(screen.getAllByLabelText(/password/i)[1], { target: { value: 'long-enough-1' } })
    fireEvent.click(screen.getByRole('button', { name: /create|sign up|register/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(en.auth.errors.emailTaken)
  })
})

describe('coming back to the page that needed an account', () => {
  const USER = {
    id: 'u1',
    email: 'lan@example.com',
    displayName: 'Lan',
    bio: '',
    avatarSeed: 'x',
    createdAt: '2026-10-31T00:00:00Z',
    isGuest: false,
  }
  const Here = () => <p>now at {useLocation().pathname + useLocation().search}</p>
  const mountAt = (state: unknown) =>
    render(
      <MemoryRouter initialEntries={[{ pathname: '/login', state }]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="*" element={<Here />} />
        </Routes>
      </MemoryRouter>,
    )
  const signIn = async () => {
    vi.mocked(login).mockResolvedValue({ user: USER, token: 'tok' } as never)
    fill(/email/i, 'lan@example.com')
    fill(/password/i, 'long-enough-1')
    submit(/sign in/i)
  }

  it('goes to the collection when nobody asked for a page (as before)', async () => {
    mountAt(undefined)
    await signIn()
    expect(await screen.findByText('now at /collection')).toBeInTheDocument()
  })

  it('goes back to the page the guest was heading for', async () => {
    mountAt({ from: '/free-draw' })
    await signIn()
    expect(await screen.findByText('now at /free-draw')).toBeInTheDocument()
  })

  it('keeps the query of that page', async () => {
    mountAt({ from: '/collection?filter=favourites' })
    await signIn()
    expect(await screen.findByText('now at /collection?filter=favourites')).toBeInTheDocument()
  })

  it('ignores a remembered address that is not inside the app', async () => {
    mountAt({ from: '//evil.example/steal' })
    await signIn()
    expect(await screen.findByText('now at /collection')).toBeInTheDocument()
  })

  it('brings the account’s numbers onto the device once signed in', async () => {
    mountAt(undefined)
    await signIn()
    await screen.findByText(/now at/)
    expect(syncProgress).toHaveBeenCalledTimes(1)
  })

  it('does not go anywhere, nor fetch numbers, when the sign-in fails', async () => {
    vi.mocked(login).mockRejectedValue(new ApiError('Incorrect', 401, 'invalid_credentials'))
    mountAt({ from: '/free-draw' })
    fill(/email/i, 'lan@example.com')
    fill(/password/i, 'wrong-password')
    submit(/sign in/i)
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText(/now at/)).not.toBeInTheDocument()
    expect(syncProgress).not.toHaveBeenCalled()
  })

  it('says why the guest is here only when they were sent here', () => {
    const first = mountAt({ from: '/collection' })
    expect(screen.getByText(en.auth.needAccount)).toBeInTheDocument()
    first.unmount()
    mountAt(undefined)
    expect(screen.queryByText(en.auth.needAccount)).not.toBeInTheDocument()
  })

  it('keeps the remembered page through "create an account"', async () => {
    mountAt({ from: '/free-draw' })
    fireEvent.click(screen.getByRole('link', { name: new RegExp(en.auth.createAccount, 'i') }))
    vi.mocked(register).mockResolvedValue({ user: USER, token: 'tok' } as never)
    fill(/name/i, 'Lan')
    fill(/email/i, 'lan@example.com')
    fireEvent.change(screen.getAllByLabelText(/password/i)[0], { target: { value: 'long-enough-1' } })
    fireEvent.change(screen.getAllByLabelText(/password/i)[1], { target: { value: 'long-enough-1' } })
    fireEvent.click(screen.getByRole('button', { name: /create|sign up|register/i }))
    expect(await screen.findByText('now at /free-draw')).toBeInTheDocument()
    expect(syncProgress).toHaveBeenCalledTimes(1)
  })

  it('a new account with no remembered page still starts at the practice list (as before)', async () => {
    vi.mocked(register).mockResolvedValue({ user: USER, token: 'tok' } as never)
    render(
      <MemoryRouter initialEntries={['/register']}>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="*" element={<Here />} />
        </Routes>
      </MemoryRouter>,
    )
    fill(/name/i, 'Lan')
    fill(/email/i, 'lan@example.com')
    fireEvent.change(screen.getAllByLabelText(/password/i)[0], { target: { value: 'long-enough-1' } })
    fireEvent.change(screen.getAllByLabelText(/password/i)[1], { target: { value: 'long-enough-1' } })
    fireEvent.click(screen.getByRole('button', { name: /create|sign up|register/i }))
    expect(await screen.findByText('now at /practice')).toBeInTheDocument()
  })
})
