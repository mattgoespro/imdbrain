import type { JSX, KeyboardEvent as ReactKeyboardEvent, Ref } from 'react'
import type { SelectOption } from './types'
import Option from './option'

export default function Menu({
  menuRef,
  id,
  options,
  value,
  top,
  left,
  width,
  maxHeight,
  onKeyDown,
  onChoose
}: {
  menuRef: Ref<HTMLDivElement>
  id: string
  options: ReadonlyArray<SelectOption>
  value: string
  top: number
  left: number
  width: number
  maxHeight: number
  onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void
  onChoose: (value: string) => void
}): JSX.Element {
  return (
    <div
      ref={menuRef}
      id={id}
      className="fixed z-40 overflow-auto rounded-app border border-line bg-raised p-1 shadow-panel"
      role="listbox"
      tabIndex={-1}
      style={{ top, left, width, maxHeight }}
      onKeyDown={onKeyDown}
    >
      {options.map((opt) => (
        <Option
          key={opt.value}
          label={opt.label}
          selected={opt.value === value}
          onSelect={() => onChoose(opt.value)}
        />
      ))}
    </div>
  )
}
