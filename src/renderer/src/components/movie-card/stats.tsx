import type { JSX } from 'react'
import { cn } from '../../lib/cn'
import Stat from './stat'

export default function Stats({
  voteAverage,
  match,
  compact
}: {
  voteAverage: number
  match: number | null
  compact?: boolean
}): JSX.Element {
  return (
    <div
      className={cn(
        'flex shrink-0',
        compact ? 'justify-start gap-5' : 'justify-end gap-4'
      )}
    >
      <Stat
        value={voteAverage.toFixed(1)}
        accent
        label="IMDb"
        compact={compact}
      />
      {match != null ? (
        <Stat value={String(Math.round(match))} label="Match" compact={compact} />
      ) : null}
    </div>
  )
}
