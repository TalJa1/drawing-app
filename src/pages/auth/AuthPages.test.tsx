import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { MemoryRouter } from 'react-router-dom'
import en from '@/i18n/en.json'
import { ApiError } from '@/api/client'
import { login, register } from '@/api/auth'
import LoginPage from './LoginPage'
import RegisterPage from './RegisterPage'

vi.mock('@/api/auth', () => ({ login: vi.fn(), register: vi.fn() }))

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
