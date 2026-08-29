import type { JSX } from 'react'
import { formatVotes } from '../../../../shared/types'
import Stat from './stat'

export default function Stats({
  voteAverage,
  match,
  voteCount
}: {
  voteAverage: number
  match: number | null | undefined
  voteCount: number
}): JSX.Element {
  return (
    <div className="mb-3.5 flex gap-5 border-b border-line pb-3.5">
      <Stat label="IMDb" value={voteAverage.toFixed(1)} />
      {match != null ? <Stat label="Match" value={`${Math.round(match)}%`} /> : null}
      <Stat label="Votes" value={formatVotes(voteCount)} />
    </div>
  )
}
