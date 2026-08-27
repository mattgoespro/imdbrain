import type { JSX } from 'react'
import { cn } from '../../lib/cn'

export default function Stat({
  value,
  label,
  accent,
  compact
}: {
  value: string
  label: string
  accent?: boolean
  compact?: boolean
}): JSX.Element {
  return (
    <div
      className={cn(
        'tabular',
        compact ? 'text-left' : 'text-right',
        accent && 'text-accent-2'
      )}
    >
      <div
        className={cn(
          'leading-none font-bold tracking-[-0.06em]',
          compact ? 'text-xl' : 'text-[22px]'
        )}
      >
        {value}
      </div>
      <small className="mt-1 block text-[10px] font-semibold tracking-[0.14em] text-faint uppercase">
        {label}
      </small>
    </div>
  )
}
