import type { JSX } from 'react'
import { formatVotes } from '../../../../shared/types'
import { IconStar } from '../icons'

export default function Caption({
  kind,
  year,
  seasons,
  runtime,
  voteCount
}: {
  kind: string | null
  year: number | null | undefined
  seasons: string | null
  runtime: string | null
  voteCount: number
}): JSX.Element {
  const yearLabel = year ?? '—'

  return (
    <div className="flex flex-wrap items-center gap-x-1.5 text-xs leading-[1.45] text-muted tabular">
      {kind ? <span>{kind}</span> : null}
      <span>{kind ? `· ${yearLabel}` : yearLabel}</span>
      {seasons ? <span>· {seasons}</span> : null}
      {runtime ? <span>· {runtime}</span> : null}
      <span className="inline-flex items-center gap-0.5">
        ·
        <IconStar className="size-3 text-faint" />
        {formatVotes(voteCount)}
      </span>
    </div>
  )
}
