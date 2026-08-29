import type { JSX } from 'react'

export default function AgeCaption({
  rating
}: {
  rating?: string
}): JSX.Element | null {
  if (!rating) return null
  return (
    <span className="ml-1.5 inline-block align-middle rounded-sm border border-line px-1 py-px text-[10px] font-650 tracking-[0.08em] text-muted text-shadow-none">
      {rating}
    </span>
  )
}
