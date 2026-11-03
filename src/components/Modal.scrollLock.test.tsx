import { useState } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
