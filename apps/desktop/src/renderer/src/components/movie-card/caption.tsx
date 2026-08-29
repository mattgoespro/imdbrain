import type { JSX } from 'react'

export default function Caption({
  compact,
  kind,
  year,
  seasons,
  runtime,
  certification
}: {
  compact?: boolean
  kind: string | null
  year: number | null | undefined
  seasons: string | null
  runtime: string | null
  certification?: string
}): JSX.Element | null {
  const parts = [kind, year ?? '—', seasons, runtime, certification].filter(Boolean)
  if (!parts.length) return null

  return (
    <div className={compact ? 'text-[11px] leading-[1.4] text-muted tabular' : 'text-xs leading-[1.45] text-muted tabular'}>
      {parts.join(' · ')}
    </div>
  )
}
