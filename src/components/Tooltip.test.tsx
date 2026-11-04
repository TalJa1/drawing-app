import { act, render, screen } from '@testing-library/react'
import { Tooltip } from './Tooltip'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const setup = () => {
  render(
    <Tooltip label="Pencil" shortcut="B">
      <button type="button">tool</button>
    </Tooltip>,
  )
  return screen.getByRole('button')
}

describe('Tooltip', () => {
  it('is not in the page while closed (a hidden bubble still widened /learn on a phone)', () => {
    setup()
    expect(document.querySelector('[role="tooltip"]')).toBeNull()
  })

  it('fades in when the trigger takes focus and is linked to it', () => {
    const button = setup()
    act(() => button.focus())
    const tip = screen.getByRole('tooltip')
    expect(tip).toHaveClass('tooltip-in')
    expect(button.parentElement).toHaveAttribute('aria-describedby', tip.id)
  })

  it('fades out for 170 ms, hidden from assistive tech, and then leaves the page', () => {
    const button = setup()
    act(() => button.focus())
    act(() => button.blur())
    const leaving = document.querySelector('[role="tooltip"]')
    expect(leaving).not.toBeNull()
    expect(leaving).toHaveClass('tooltip-out')
    expect(leaving).toHaveAttribute('aria-hidden', 'true')
    act(() => void vi.advanceTimersByTime(180))
    expect(document.querySelector('[role="tooltip"]')).toBeNull()
  })

  it('opened again during the fade-out, it stays', () => {
    const button = setup()
    act(() => button.focus())
    act(() => button.blur())
    act(() => void vi.advanceTimersByTime(80))
    act(() => button.focus())
    act(() => void vi.advanceTimersByTime(400))
    expect(screen.getByRole('tooltip')).toHaveClass('tooltip-in')
  })
})
