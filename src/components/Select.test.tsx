import { useState } from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { Select } from './Form'
import { Modal } from './Modal'
import { SelectControl, type SelectOption } from './Select'
import { useSettings } from '@/store/settings'

/*
 * The drop-down list. With the brush cursor in use the app draws the list itself (a native <select>'s pop-up is drawn by
 * the browser, outside the page, with the system arrow); without it, or on a touch screen, it is the native <select>.
 */

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

const OPTIONS: SelectOption[] = [
  { value: 'popular', label: 'Popular' },
  { value: 'new', label: 'Newest' },
  { value: 'old', label: 'Oldest', disabled: true },
  { value: 'easiest', label: 'Easiest' },
  { value: 'hardest', label: 'Hardest' },
]

function mockPointer(coarse: boolean) {
  window.matchMedia = ((q: string) => ({
    matches: coarse && q.includes('pointer: coarse'),
    media: q,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
    onchange: null,
  })) as unknown as typeof window.matchMedia
}

function Harness({ initial = 'popular', onValue }: { initial?: string; onValue?: (v: string) => void }) {
  const [v, setV] = useState(initial)
  return (
    <>
      <label id="sort-label">Sort by</label>
      <SelectControl
        aria-labelledby="sort-label"
        value={v}
        options={OPTIONS}
        onValueChange={(x) => {
          setV(x)
          onValue?.(x)
        }}
      />
      <output data-testid="value">{v}</output>
    </>
  )
}

beforeEach(() => {
  mockPointer(false)
  useSettings.setState({ customCursor: true })
})
afterEach(() => {
  useSettings.setState({ customCursor: true })
})

describe('which control is drawn', () => {
  it('draws its own list while the brush cursor is in use', () => {
    render(<Harness />)
    expect(screen.getByRole('combobox', { name: 'Sort by' })).toHaveTextContent('Popular')
    expect(document.querySelector('select')).toBeNull()
  })

  it('is the browser’s own <select> when the brush cursor is switched off', () => {
    useSettings.setState({ customCursor: false })
    const seen: string[] = []
    render(<Harness onValue={(v) => seen.push(v)} />)
    const native = screen.getByRole('combobox', { name: 'Sort by' }) as HTMLSelectElement
    expect(native.tagName).toBe('SELECT')
    fireEvent.change(native, { target: { value: 'easiest' } })
    expect(seen).toEqual(['easiest'])
  })

  it('is the browser’s own <select> on a touch screen (the system picker suits it better)', () => {
    mockPointer(true)
    render(<Harness />)
    expect(screen.getByRole('combobox', { name: 'Sort by' }).tagName).toBe('SELECT')
  })
})

describe('the drawn list', () => {
  it('opens on click, lists every option and marks the chosen one', () => {
    render(<Harness initial="new" />)
    const box = screen.getByRole('combobox', { name: 'Sort by' })
    expect(box).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(box)
    expect(box).toHaveAttribute('aria-expanded', 'true')
    const list = screen.getByRole('listbox')
    const options = within(list).getAllByRole('option')
    expect(options.map((o) => o.textContent)).toEqual(['Popular', 'Newest', 'Oldest', 'Easiest', 'Hardest'])
    expect(options[1]).toHaveAttribute('aria-selected', 'true')
    expect(options[0]).toHaveAttribute('aria-selected', 'false')
    expect(options[2]).toHaveAttribute('aria-disabled', 'true')
    expect(box).toHaveAttribute('aria-controls', list.id)
    expect(box).toHaveAttribute('aria-activedescendant', options[1].id) // opens on the chosen option
  })

  it('a click on an option chooses it and closes the list', async () => {
    const seen: string[] = []
    render(<Harness onValue={(v) => seen.push(v)} />)
    fireEvent.click(screen.getByRole('combobox', { name: 'Sort by' }))
    fireEvent.click(screen.getByRole('option', { name: 'Easiest' }))
    expect(seen).toEqual(['easiest'])
    expect(screen.getByTestId('value')).toHaveTextContent('easiest')
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false')
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull()) // gone once its fade-out is over
  })

  it('does not choose a disabled option', () => {
    const seen: string[] = []
    render(<Harness onValue={(v) => seen.push(v)} />)
    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(screen.getByRole('option', { name: 'Oldest' }))
    expect(seen).toEqual([])
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'true')
  })

  it('works from the keyboard: arrows (skipping disabled options), Home/End, Enter', () => {
    const seen: string[] = []
    render(<Harness onValue={(v) => seen.push(v)} />)
    const box = screen.getByRole('combobox')
    box.focus()
    fireEvent.keyDown(box, { key: 'ArrowDown' }) // opens on the chosen option (Popular)
    expect(box).toHaveAttribute('aria-expanded', 'true')
    const active = () => document.getElementById(box.getAttribute('aria-activedescendant') ?? '')?.textContent
    expect(active()).toBe('Popular')
    fireEvent.keyDown(box, { key: 'ArrowDown' })
    expect(active()).toBe('Newest')
    fireEvent.keyDown(box, { key: 'ArrowDown' }) // Oldest is disabled
    expect(active()).toBe('Easiest')
    fireEvent.keyDown(box, { key: 'End' })
    expect(active()).toBe('Hardest')
    fireEvent.keyDown(box, { key: 'ArrowDown' }) // already last: stays
    expect(active()).toBe('Hardest')
    fireEvent.keyDown(box, { key: 'Home' })
    expect(active()).toBe('Popular')
    fireEvent.keyDown(box, { key: 'ArrowUp' }) // already first: stays
    expect(active()).toBe('Popular')
    fireEvent.keyDown(box, { key: 'End' })
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(seen).toEqual(['hardest'])
    expect(box).toHaveAttribute('aria-expanded', 'false')
  })

  it('Space opens it, and Space on an option chooses it', () => {
    const seen: string[] = []
    render(<Harness onValue={(v) => seen.push(v)} />)
    const box = screen.getByRole('combobox')
    box.focus()
    fireEvent.keyDown(box, { key: ' ' })
    expect(box).toHaveAttribute('aria-expanded', 'true')
    fireEvent.keyDown(box, { key: 'ArrowDown' })
    fireEvent.keyDown(box, { key: ' ' })
    expect(seen).toEqual(['new'])
  })

  it('type-ahead: letters typed together jump to the option that starts with them', () => {
    const seen: string[] = []
    render(<Harness onValue={(v) => seen.push(v)} />)
    const box = screen.getByRole('combobox')
    box.focus()
    fireEvent.keyDown(box, { key: 'h' })
    expect(box).toHaveAttribute('aria-expanded', 'true')
    const active = () => document.getElementById(box.getAttribute('aria-activedescendant') ?? '')?.textContent
    expect(active()).toBe('Hardest')
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(seen).toEqual(['hardest'])
  })

  it('Escape closes the list and gives the focus back to the control', async () => {
    render(<Harness />)
    const box = screen.getByRole('combobox')
    box.focus()
    fireEvent.click(box)
    fireEvent.keyDown(document.activeElement ?? box, { key: 'Escape' })
    expect(box).toHaveAttribute('aria-expanded', 'false')
    expect(document.activeElement).toBe(box)
  })

  it('a press outside closes it without choosing anything', () => {
    const seen: string[] = []
    render(
      <>
        <button>elsewhere</button>
        <Harness onValue={(v) => seen.push(v)} />
      </>,
    )
    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.pointerDown(screen.getByText('elsewhere'))
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false')
    expect(seen).toEqual([])
  })

  it('closes when a scroll moves the control, but not when the list itself scrolls or the control stayed put', () => {
    render(<Harness />)
    const box = screen.getByRole('combobox')
    let top = 100
    box.getBoundingClientRect = () => ({
      top,
      left: 10,
      bottom: top + 40,
      right: 170,
      width: 160,
      height: 40,
      x: 10,
      y: top,
      toJSON: () => ({}),
    })
    fireEvent.click(box)
    fireEvent.scroll(screen.getByRole('listbox'))
    expect(box).toHaveAttribute('aria-expanded', 'true')
    // a late scroll event after a scroll that ended before the list opened: the control has not moved
    fireEvent.scroll(document)
    expect(box).toHaveAttribute('aria-expanded', 'true')
    top = 60
    fireEvent.scroll(document)
    expect(box).toHaveAttribute('aria-expanded', 'false')
  })

  it('Tab chooses the highlighted option and lets the focus move on', () => {
    const seen: string[] = []
    render(<Harness onValue={(v) => seen.push(v)} />)
    const box = screen.getByRole('combobox')
    box.focus()
    fireEvent.keyDown(box, { key: 'ArrowDown' })
    fireEvent.keyDown(box, { key: 'ArrowDown' })
    fireEvent.keyDown(box, { key: 'Tab' })
    expect(seen).toEqual(['new'])
    expect(box).toHaveAttribute('aria-expanded', 'false')
  })

  it('a disabled control does not open', () => {
    render(<SelectControl aria-label="x" value="popular" options={OPTIONS} onValueChange={() => undefined} disabled />)
    fireEvent.click(screen.getByRole('combobox'))
    expect(screen.queryByRole('listbox')).toBeNull()
  })
})

describe('inside a dialog', () => {
  it('Escape closes only the list; the dialog stays open until Escape is pressed again', async () => {
    function Dialog() {
      const [open, setOpen] = useState(true)
      return (
        <Modal open={open} onClose={() => setOpen(false)} title="Filters">
          <Harness />
        </Modal>
      )
    }
    render(<Dialog />)
    const box = screen.getByRole('combobox', { name: 'Sort by' })
    box.focus()
    fireEvent.click(box)
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    fireEvent.keyDown(document.activeElement ?? box, { key: 'Escape' })
    expect(box).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('dialog')).toBeInTheDocument() // the dialog is still there

    fireEvent.keyDown(document.activeElement ?? box, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('the list is drawn above the dialog', () => {
    render(
      <Modal open onClose={() => undefined} title="Filters">
        <Harness />
      </Modal>,
    )
    fireEvent.click(screen.getByRole('combobox'))
    const z = (el: Element) => Number(/z-\[(\d+)\]/.exec(el.className)?.[1] ?? 0)
    const modalLayer = screen.getByRole('dialog').parentElement!
    expect(z(screen.getByRole('listbox'))).toBeGreaterThan(z(modalLayer))
  })
})

describe('Select (labelled field)', () => {
  it('reads its <option> children and reports the chosen value', () => {
    const seen: string[] = []
    render(
      <Select label="Sort by" value="new" onValueChange={(v) => seen.push(v)}>
        <option value="popular">Popular</option>
        <option value="new">Newest</option>
        {['a', 'b'].map((x) => (
          <option key={x} value={x}>
            Option {x}
          </option>
        ))}
      </Select>,
    )
    const box = screen.getByRole('combobox', { name: 'Sort by' })
    expect(box).toHaveTextContent('Newest')
    fireEvent.click(box)
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Popular', 'Newest', 'Option a', 'Option b'])
    fireEvent.click(screen.getByRole('option', { name: 'Option b' }))
    expect(seen).toEqual(['b'])
  })

  it('keeps its own value when it is not controlled (defaultValue)', () => {
    render(
      <Select label="Sort by" defaultValue="popular">
        <option value="new">Newest</option>
        <option value="popular">Popular</option>
      </Select>,
    )
    const box = screen.getByRole('combobox', { name: 'Sort by' })
    expect(box).toHaveTextContent('Popular')
    fireEvent.click(box)
    fireEvent.click(screen.getByRole('option', { name: 'Newest' }))
    expect(box).toHaveTextContent('Newest')
  })

  it('hides its label visually but keeps it for screen readers (hideLabel)', () => {
    render(
      <Select label="Sort by" hideLabel value="x">
        <option value="x">X</option>
      </Select>,
    )
    expect(screen.getByText('Sort by')).toHaveClass('sr-only')
    expect(screen.getByRole('combobox', { name: 'Sort by' })).toBeInTheDocument()
  })

  it('posts its value in a form when it has a name', () => {
    const { container } = render(
      <form>
        <Select label="Sort by" name="sort" value="new">
          <option value="new">Newest</option>
        </Select>
      </form>,
    )
    expect((container.querySelector('input[name="sort"]') as HTMLInputElement).value).toBe('new')
  })
})
