import type { JSX } from 'react'

export default function GenreCaption({
  genres
}: {
  genres: string
}): JSX.Element | null {
  if (!genres) return null
  return (
    <div className="text-xs leading-[1.45] text-faint tabular">{genres}</div>
  )
}
