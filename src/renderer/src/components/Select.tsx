import { useEffect, useId, useRef, useState, type JSX, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../lib/cn'

export type SelectOption = { value: string; label: string }

export default function Select({
  value,
  options,
  onChange,
  ariaLabel
}: {
  value: string
  options: ReadonlyArray<{ value: string; label: string }>
  onChange: (value: string) => void
  ariaLabel?: string
}): JSX.Element {
  const id = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 0, maxHeight: 280 })
  const selected = options.find((opt) => opt.value === value) ?? options[0]

  function placeMenu(): void {
    const button = buttonRef.current
    if (!button) return
    const rect = button.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom - 12
    const spaceAbove = rect.top - 12
    const maxHeight = Math.min(280, Math.max(spaceBelow, spaceAbove))
    const openUp = spaceBelow < 160 && spaceAbove > spaceBelow
    setMenuPos({
      top: openUp ? rect.top - maxHeight - 4 : rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      maxHeight
    })
  }

  useEffect(() => {
    if (!open) return
    placeMenu()
    queueMicrotask(() => menuRef.current?.focus())
    const onDoc = (event: MouseEvent): void => {
      const target = event.target as Node
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    const onReposition = (): void => placeMenu()
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [open])

  function choose(next: string): void {
    onChange(next)
    setOpen(false)
    buttonRef.current?.focus()
  }

  function onButtonKey(event: ReactKeyboardEvent<HTMLButtonElement>): void {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setOpen(true)
    }
  }

  function onMenuKey(event: ReactKeyboardEvent<HTMLDivElement>): void {
    const index = options.findIndex((opt) => opt.value === value)
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      const next = options[Math.min(options.length - 1, index + 1)]
      if (next) onChange(next.value)
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      const next = options[Math.max(0, index - 1)]
      if (next) onChange(next.value)
    }
    if (event.key === 'Enter' || event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      buttonRef.current?.focus()
    }
  }

  return (
    <div className="w-full">
      <button
        ref={buttonRef}
        type="button"
        className={cn(
          'flex w-full min-w-0 max-w-full items-center justify-between gap-2.5 rounded-app border bg-input px-3 py-2.5 text-left text-ink outline-none transition-colors duration-140',
          open ? 'border-accent' : 'border-line focus-visible:border-accent'
        )}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={onButtonKey}
      >
        <span className="min-w-0 truncate">{selected?.label}</span>
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="size-4 shrink-0 fill-none stroke-muted stroke-[1.75] [stroke-linecap:round] [stroke-linejoin:round]"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open
        ? createPortal(
            <div
              ref={menuRef}
              id={id}
              className="fixed z-40 overflow-auto rounded-app border border-line bg-raised p-1 shadow-panel"
              role="listbox"
              tabIndex={-1}
              style={{
                top: menuPos.top,
                left: menuPos.left,
                width: menuPos.width,
                maxHeight: menuPos.maxHeight
              }}
              onKeyDown={onMenuKey}
            >
              {options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={opt.value === value}
                  className={cn(
                    'block w-full rounded-lg border-0 px-2.5 py-2 text-left text-[13px] hover:bg-accent-soft hover:text-accent-2',
                    opt.value === value
                      ? 'bg-accent-soft font-semibold text-accent-2'
                      : 'bg-transparent text-ink'
                  )}
                  onClick={() => choose(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>,
            document.body
          )
        : null}
    </div>
  )
}
