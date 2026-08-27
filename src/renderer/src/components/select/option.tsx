import type { JSX } from 'react'
import { cn } from '../../lib/cn'

export default function Option({
  label,
  selected,
  onSelect
}: {
  label: string
  selected: boolean
  onSelect: () => void
}): JSX.Element {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      className={cn(
        'block w-full rounded-lg border-0 px-2.5 py-2 text-left text-[13px] hover:bg-accent-soft hover:text-accent-2',
        selected ? 'bg-accent-soft font-semibold text-accent-2' : 'bg-transparent text-ink'
      )}
      onClick={onSelect}
    >
      {label}
    </button>
  )
}
