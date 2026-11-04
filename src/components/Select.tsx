import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import { useCustomCursorActive } from '@/app/theme'
import { cn } from '@/lib/utils'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface SelectControlProps {
  id?: string
  value: string
  onValueChange: (value: string) => void
  options: SelectOption[]
  /** md: a form field (40px). sm: a control inside a toolbar (32px). */
  size?: 'md' | 'sm'
  disabled?: boolean
  className?: string
  name?: string
  'aria-label'?: string
  'aria-labelledby'?: string
}

const TRIGGER = {
  md: 'h-10 w-full rounded-full pl-4 pr-9 text-sm',
  sm: 'h-8 rounded-full pl-3 pr-8 text-xs',
}
const MAX_LIST_HEIGHT = 288
const GAP = 6
const EDGE = 8
/** how long the pop-up stays in the page after it is closed, so that its fade-out can play */
const EXIT_MS = 120

/**
 * A drop-down list. While the brush cursor is in use the pop-up of a native <select> cannot show it (the browser draws
 * that pop-up itself, outside the page, with the system arrow), so the list is drawn by the app, following the
 * WAI-ARIA "select-only combobox" pattern: arrow keys, Home/End, type-ahead, Enter/Space to choose, Escape to close.
 * On a touch screen, or with the brush cursor switched off, it is the browser's own <select>, which suits those better
 * (a touch device shows its native picker).
 */
export function SelectControl(props: SelectControlProps) {
  const custom = useCustomCursorActive()
  return custom ? <ListboxSelect {...props} /> : <NativeSelect {...props} />
}

function NativeSelect({ id, value, onValueChange, options, size = 'md', disabled, className, name, ...aria }: SelectControlProps) {
  return (
    <div className={cn('relative', size === 'md' && 'w-full', className)}>
      <select
        id={id}
        name={name}
        value={value}
        disabled={disabled}
        onChange={(e) => onValueChange(e.target.value)}
        className={cn(
          'border border-line-strong bg-card text-ink',
          size === 'md'
            ? 'h-10 w-full appearance-none rounded-full pl-4 pr-9 text-sm hover:border-ink/50'
            : 'h-8 w-full rounded-full px-3 text-xs',
        )}
        aria-label={aria['aria-label']}
        aria-labelledby={aria['aria-labelledby']}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      {size === 'md' && <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint" />}
    </div>
  )
}

const firstEnabled = (opts: SelectOption[], from: number, step: 1 | -1) => {
  for (let i = from; i >= 0 && i < opts.length; i += step) if (!opts[i].disabled) return i
  return -1
}

function ListboxSelect({ id, value, onValueChange, options, size = 'md', disabled, className, name, ...aria }: SelectControlProps) {
  const autoId = useId()
  const listId = `${autoId}-list`
  const optId = (i: number) => `${autoId}-opt-${i}`
  const trigger = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const [open, setOpen] = useState(false)
  // the list stays in the page while open and for the length of its fade-out (the same way Tooltip does)
  const [mounted, setMounted] = useState(false)
  if (open && !mounted) setMounted(true)
  const [active, setActive] = useState(-1)
  const [place, setPlace] = useState<{ style: CSSProperties; up: boolean }>({ style: {}, up: false })
  const typed = useRef({ text: '', at: 0 })
  // where the control was when the list opened: a scroll closes the list only if it really moved the control away
  const openedAt = useRef<{ top: number; left: number } | null>(null)

  const selected = options.findIndex((o) => o.value === value)

  useEffect(() => {
    if (open || !mounted) return
    const t = window.setTimeout(() => setMounted(false), EXIT_MS)
    return () => window.clearTimeout(t)
  }, [open, mounted])

  const close = useCallback((refocus = false) => {
    setOpen(false)
    if (refocus) trigger.current?.focus()
  }, [])

  const openList = useCallback(
    (at?: number) => {
      if (disabled) return
      const el = trigger.current
      if (!el) return
      const r = el.getBoundingClientRect()
      openedAt.current = { top: r.top, left: r.left }
      const below = window.innerHeight - r.bottom - EDGE - GAP
      const above = r.top - EDGE - GAP
      const up = below < Math.min(MAX_LIST_HEIGHT, 180) && above > below
      const maxHeight = Math.max(96, Math.min(MAX_LIST_HEIGHT, up ? above : below))
      const wide = Math.max(r.width, 180)
      const alignRight = r.left + wide > window.innerWidth - EDGE
      setPlace({
        up,
        style: {
          minWidth: r.width,
          maxWidth: window.innerWidth - EDGE * 2,
          maxHeight,
          ...(alignRight ? { right: Math.max(EDGE, window.innerWidth - r.right) } : { left: Math.max(EDGE, r.left) }),
          ...(up ? { bottom: window.innerHeight - r.top + GAP } : { top: r.bottom + GAP }),
        },
      })
      setActive(at ?? (selected >= 0 ? selected : firstEnabled(options, 0, 1)))
      setOpen(true)
    },
    [disabled, options, selected],
  )

  const choose = useCallback(
    (i: number) => {
      const o = options[i]
      if (!o || o.disabled) return
      if (o.value !== value) onValueChange(o.value)
      close(true)
    },
    [options, value, onValueChange, close],
  )

  // while the list is open: Escape closes only the list (a dialog around the control must stay open), a press outside
  // closes it, and so does anything that would move the control away from the list
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // the window sees the key before the document, where a dialog listens for it
      e.stopPropagation()
      e.preventDefault()
      close(true)
    }
    const onPress = (e: PointerEvent) => {
      const t = e.target as Node | null
      if (t && (trigger.current?.contains(t) || list.current?.contains(t))) return
      close()
    }
    const onScroll = (e: Event) => {
      if (e.target instanceof Node && list.current?.contains(e.target)) return
      // a scroll event can arrive late (a scroll that finished just before the list opened): only a control that has
      // really moved leaves the list hanging in the wrong place
      const r = trigger.current?.getBoundingClientRect()
      const at = openedAt.current
      if (r && at && Math.abs(r.top - at.top) < 1 && Math.abs(r.left - at.left) < 1) return
      close()
    }
    const onResize = () => close()
    window.addEventListener('keydown', onKey, true)
    document.addEventListener('pointerdown', onPress, true)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      document.removeEventListener('pointerdown', onPress, true)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [open, close])

  // keep the highlighted option in view (arrow keys, type-ahead, opening on a chosen option). The list is scrolled by
  // hand: scrollIntoView may scroll the page too, and the page scrolling closes the list.
  useLayoutEffect(() => {
    const box = list.current
    if (!open || active < 0 || !box) return
    const li = box.children[active] as HTMLElement | undefined
    if (!li) return
    if (li.offsetTop < box.scrollTop) box.scrollTop = li.offsetTop - 6
    else if (li.offsetTop + li.offsetHeight > box.scrollTop + box.clientHeight)
      box.scrollTop = li.offsetTop + li.offsetHeight - box.clientHeight + 6
  }, [open, active])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled || (e.altKey && e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return
    const last = options.length - 1
    const move = (i: number, step: 1 | -1) => {
      const next = firstEnabled(options, i, step)
      if (next >= 0) setActive(next)
    }
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        e.preventDefault()
        if (!open) return openList()
        if (e.altKey && e.key === 'ArrowUp') return choose(active)
        if (e.key === 'ArrowDown') move(Math.min(last, active + 1), 1)
        else move(Math.max(0, active - 1), -1)
        return
      }
      case 'Home':
      case 'End': {
        e.preventDefault()
        if (!open) return openList(e.key === 'Home' ? firstEnabled(options, 0, 1) : firstEnabled(options, last, -1))
        if (e.key === 'Home') move(0, 1)
        else move(last, -1)
        return
      }
      case 'PageDown':
      case 'PageUp': {
        if (!open) return
        e.preventDefault()
        if (e.key === 'PageDown') move(Math.min(last, active + 10), -1)
        else move(Math.max(0, active - 10), 1)
        return
      }
      case 'Enter':
      case ' ': {
        if (e.key === ' ' && typed.current.text && Date.now() - typed.current.at < 600) break // a space inside a word being typed
        e.preventDefault()
        if (!open) return openList()
        return choose(active)
      }
      case 'Tab':
        if (open) {
          if (active >= 0 && !options[active].disabled && options[active].value !== value) onValueChange(options[active].value)
          close()
        }
        return
    }
    // type-ahead: letters typed in quick succession jump to the option that starts with them
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const now = Date.now()
      const text = (now - typed.current.at < 600 ? typed.current.text : '') + e.key.toLowerCase()
      typed.current = { text, at: now }
      const from = text.length === 1 ? (open ? active : selected) + 1 : Math.max(0, open ? active : selected)
      const order = [...options.keys()].map((_, k) => (from + k) % options.length)
      const hit = order.find((i) => !options[i].disabled && options[i].label.toLowerCase().startsWith(text))
      if (hit !== undefined) {
        e.preventDefault()
        if (!open) openList(hit)
        else setActive(hit)
      }
    }
  }

  const shown = selected >= 0 ? options[selected].label : ''
  return (
    <div className={cn('relative', size === 'md' && 'w-full', className)}>
      <button
        ref={trigger}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={mounted ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? optId(active) : undefined}
        aria-label={aria['aria-label']}
        aria-labelledby={aria['aria-labelledby']}
        disabled={disabled}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKeyDown}
        onBlur={() => close()}
        className={cn(
          'relative flex w-full items-center truncate border border-line-strong bg-card text-left text-ink hover:border-ink/50 disabled:opacity-50',
          TRIGGER[size],
          open && 'border-ink/60',
        )}
      >
        <span className="truncate">{shown}</span>
        <ChevronDown
          size={size === 'md' ? 16 : 14}
          aria-hidden
          className={cn(
            'pointer-events-none absolute top-1/2 -translate-y-1/2 text-ink-faint transition-transform duration-200',
            size === 'md' ? 'right-3' : 'right-2.5',
            open && 'rotate-180',
          )}
        />
      </button>
      {name && <input type="hidden" name={name} value={value} />}
      {mounted &&
        createPortal(
          <ul
            ref={list}
            id={listId}
            role="listbox"
            tabIndex={-1}
            aria-labelledby={aria['aria-labelledby']}
            aria-label={aria['aria-label']}
            aria-hidden={open ? undefined : true}
            style={
              { ...place.style, '--pop-shift': place.up ? '6px' : '-6px', transformOrigin: place.up ? 'bottom' : 'top' } as CSSProperties
            }
            // a press on the list must not take the focus away from the control
            onMouseDown={(e) => e.preventDefault()}
            className={cn(
              'fixed z-[120] overflow-y-auto overscroll-contain rounded-2xl border border-line-strong bg-card p-1.5 shadow-lift scrollbar-thin',
              open ? 'select-pop-in' : 'select-pop-out pointer-events-none',
            )}
          >
            {options.map((o, i) => (
              <li
                key={o.value}
                id={optId(i)}
                role="option"
                aria-selected={i === selected}
                aria-disabled={o.disabled || undefined}
                data-active={i === active || undefined}
                onClick={() => choose(i)}
                onPointerMove={() => !o.disabled && i !== active && setActive(i)}
                className={cn(
                  'group flex cursor-pointer select-none items-center justify-between gap-3 rounded-xl px-3 py-2 text-ink',
                  'transition-[background-color,color,transform] duration-150 ease-out',
                  size === 'md' ? 'text-sm' : 'text-xs',
                  // hover and the keyboard's highlight are the same state (`data-active`): a warm tint, the label leans in
                  'data-[active]:bg-accent/[0.13] data-[active]:text-accent-ink',
                  !o.disabled && 'active:scale-[0.985]',
                  i === selected && 'font-medium',
                  o.disabled && 'cursor-not-allowed opacity-45',
                )}
              >
                <span className="truncate transition-transform duration-150 ease-out group-data-[active]:translate-x-1">{o.label}</span>
                {i === selected && <Check size={14} aria-hidden className="shrink-0 text-accent-ink" />}
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </div>
  )
}
