import type { JSX } from 'react'
import type { Genre } from '../../../../shared/types'
import { cn } from '../../lib/cn'

export default function GenreChips({
  genres,
  selected,
  onToggle
}: {
  genres: Genre[]
  selected: number[]
  onToggle: (id: number) => void
}): JSX.Element {
  return (
    <div className="mb-1 flex min-w-0 flex-col gap-1.5 text-xs font-medium text-muted">
      Genres
      <p className="m-0 text-[11px] leading-[1.3] text-faint">
        {selected.length
          ? 'Match any selected genre.'
          : 'None selected — all genres included.'}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {genres.map((genre) => (
          <button
            type="button"
            key={genre.id}
            className={cn(
              'rounded-full border px-2.5 py-1 text-[11px] leading-[1.2] font-semibold whitespace-nowrap transition-[background,color,border-color] duration-140',
              selected.includes(genre.id)
                ? 'border-accent bg-accent text-accent-ink'
                : 'border-line bg-white/3 text-muted'
            )}
            onClick={() => onToggle(genre.id)}
          >
            {genre.name}
          </button>
        ))}
      </div>
    </div>
  )
}
