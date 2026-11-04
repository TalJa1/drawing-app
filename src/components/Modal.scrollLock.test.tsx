import { StrictMode, useState } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { Modal, Sheet } from './Modal'

/*
 * Page scrolling after a dialog closes. Dialogs lock the page's scroll while they are open. The collection's
 * "delete this artwork?" question is a dialog inside the artwork's dialog, and answering it closes both at once;
 * a lock that hands back "what the page had before" can put the lock back instead of taking it off.
 */

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

const locked = () => document.body.style.overflow === 'hidden'

/** The same shape as the collection's Lightbox: a dialog whose body holds a second, small dialog. */
function Nested() {
  const [outer, setOuter] = useState(false)
  const [inner, setInner] = useState(false)
  return (
    <>
      <button onClick={() => setOuter(true)}>open</button>
      <Modal open={outer} onClose={() => setOuter(false)} title="artwork">
        <button onClick={() => setInner(true)}>ask</button>
        <Modal open={inner} onClose={() => setInner(false)} title="sure?">
          <button
            onClick={() => {
              setInner(false)
              setOuter(false)
            }}
          >
            yes
          </button>
        </Modal>
      </Modal>
    </>
  )
}

beforeEach(() => {
  document.body.style.overflow = ''
})

describe('scroll lock', () => {
  it('releases the page after a dialog inside a dialog is answered and both close together', async () => {
    render(<Nested />)
    fireEvent.click(screen.getByText('open'))
    fireEvent.click(screen.getByText('ask'))
    expect(locked()).toBe(true)

    fireEvent.click(screen.getByText('yes'))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 3000 })
    expect(document.body.style.overflow).toBe('')
  })

  it('releases the page when the outer dialog closes first and the inner one after', async () => {
    render(<Nested />)
    fireEvent.click(screen.getByText('open'))
    fireEvent.click(screen.getByText('ask'))
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryAllByRole('dialog').length).toBeLessThan(2), { timeout: 3000 })
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 3000 })
    expect(document.body.style.overflow).toBe('')
  })

  it('keeps the page locked while one of two open dialogs is still open', async () => {
    function Two() {
      const [a, setA] = useState(true)
      const [b, setB] = useState(true)
      return (
        <>
          <button onClick={() => setA(false)}>close a</button>
          <button onClick={() => setB(false)}>close b</button>
          <Modal open={a} onClose={() => setA(false)} title="a" />
          <Sheet open={b} onClose={() => setB(false)} title="b" />
        </>
      )
    }
    render(<Two />)
    expect(locked()).toBe(true)
    fireEvent.click(screen.getByText('close a'))
    await act(async () => {})
    expect(locked()).toBe(true)
    fireEvent.click(screen.getByText('close b'))
    await waitFor(() => expect(document.body.style.overflow).toBe(''))
  })

  it('gives back a value the page set itself, not just the empty string', async () => {
    document.body.style.overflow = 'scroll'
    function One() {
      const [o, setO] = useState(true)
      return <Modal open={o} onClose={() => setO(false)} title="x" />
    }
    render(<One />)
    expect(locked()).toBe(true)
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 3000 })
    expect(document.body.style.overflow).toBe('scroll')
  })
})

/*
 * More ways a dialog can end, each of which once could leave `body { overflow: hidden }` behind (the page then
 * cannot be scrolled at all): the page under it is left (route change / back button), React's StrictMode runs the
 * effect twice, a dialog is opened and closed in quick succession, and three dialogs close in every possible order.
 */
describe('scroll lock — other ways out', () => {
  it('releases the page when the page that holds the open dialog is left (route change, back button)', async () => {
    function Away() {
      const go = useNavigate()
      return <button onClick={() => go('/other')}>leave</button>
    }
    function WithDialog() {
      return (
        <>
          <Away />
          <Modal open onClose={() => undefined} title="stuck?" />
        </>
      )
    }
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<WithDialog />} />
          <Route path="/other" element={<p>other page</p>} />
        </Routes>
      </MemoryRouter>,
    )
    expect(locked()).toBe(true)
    fireEvent.click(screen.getByText('leave'))
    await screen.findByText('other page')
    expect(document.body.style.overflow).toBe('')
  })

  it('works under StrictMode (effects run, are cleaned up and run again)', async () => {
    document.body.style.overflow = 'auto'
    function One() {
      const [o, setO] = useState(true)
      return <Modal open={o} onClose={() => setO(false)} title="x" />
    }
    const { unmount } = render(
      <StrictMode>
        <One />
      </StrictMode>,
    )
    expect(locked()).toBe(true)
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 3000 })
    expect(document.body.style.overflow).toBe('auto')
    unmount()
    expect(document.body.style.overflow).toBe('auto')
  })

  it('survives being opened and closed in quick succession', async () => {
    function Flip() {
      const [o, setO] = useState(false)
      return (
        <>
          <button onClick={() => setO((v) => !v)}>flip</button>
          <Sheet open={o} onClose={() => setO(false)} title="s" />
        </>
      )
    }
    render(<Flip />)
    for (let i = 0; i < 9; i++) fireEvent.click(screen.getByText('flip')) // 9 clicks: ends open
    expect(locked()).toBe(true)
    fireEvent.click(screen.getByText('flip')) // 10th: closed
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 3000 })
    expect(document.body.style.overflow).toBe('')
  })

  const orders: number[][] = [
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0],
  ]
  it.each(orders)('three dialogs closed in the order %i, %i, %i give the page back as it was', async (...order) => {
    document.body.style.overflow = 'clip'
    function Three() {
      const [open, setOpen] = useState([true, true, true])
      const close = (i: number) => setOpen((o) => o.map((v, j) => (j === i ? false : v)))
      return (
        <>
          {[0, 1, 2].map((i) => (
            <button key={i} onClick={() => close(i)}>
              close {i}
            </button>
          ))}
          <Modal open={open[0]} onClose={() => close(0)} title="m0" />
          <Sheet open={open[1]} onClose={() => close(1)} title="s1" />
          <Modal open={open[2]} onClose={() => close(2)} title="m2" />
        </>
      )
    }
    render(<Three />)
    expect(locked()).toBe(true)
    for (const i of order) {
      expect(locked(), `still locked before closing #${i}`).toBe(true)
      fireEvent.click(screen.getByText(`close ${i}`))
      await act(async () => {})
    }
    await waitFor(() => expect(document.body.style.overflow).toBe('clip'), { timeout: 3000 })
  })
})
