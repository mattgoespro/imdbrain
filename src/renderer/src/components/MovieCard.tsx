import type { CSSProperties, JSX } from 'react'
import type { MovieSummary, RankedMovie } from '../../../shared/types'
import { formatRuntime, formatSeasons, formatVotes, posterUrl, titleKindLabel } from '../../../shared/types'
import { IconStar } from './Icons'
import { cn } from '../lib/cn'

export default function MovieCard({
  movie,
  genreMap,
  active,
  layout = 'list',
  entering = false,
  enterDelay = 0,
  onOpen
}: {
  movie: MovieSummary | RankedMovie
  genreMap: Map<number, string>
  active?: boolean
  layout?: 'list' | 'grid'
  entering?: boolean
  enterDelay?: number
  onOpen: (movie: MovieSummary) => void
}): JSX.Element {
  const poster = posterUrl(movie.posterPath, 'w185')
  const match = 'match' in movie ? movie.match : null
  const genres = movie.genreIds
    .map((id) => genreMap.get(id))
    .filter(Boolean)
    .slice(0, 3)
    .join(' · ')
  const grid = layout === 'grid'
  const runtime = formatRuntime(movie.runtime)
  const seasons = formatSeasons(movie.seasonCount)
  const kind = movie.titleKind && movie.titleKind !== 'movie' ? titleKindLabel(movie.titleKind) : null

  return (
    <button
      className={cn(
        grid
          ? 'flex w-full flex-col items-stretch gap-2 rounded-none border-0 bg-transparent p-0 pb-2 text-left text-inherit shadow-none'
          : 'mr-[var(--rail-gutter,14px)] grid w-auto grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3 rounded-none border-0 border-b border-line bg-transparent py-2.5 pr-2.5 pl-1.5 text-left text-inherit transition-[background,box-shadow] duration-140',
        !grid && !active && 'hover:bg-white/3',
        !grid && active && 'inset-accent bg-accent-soft',
        entering && 'animate-result-in enter-delay'
      )}
      type="button"
      style={{ '--enter-delay': `${enterDelay}ms` } as CSSProperties}
      onClick={() => onOpen(movie)}
    >
      <div
        className={
          grid
            ? cn(
                'poster-ph relative aspect-2/3 h-auto w-full shrink-0 overflow-hidden rounded-lg',
                active && 'shadow-[0_0_0_2px_var(--color-accent)]'
              )
            : 'poster-ph relative h-19.5 w-13 shrink-0 overflow-hidden rounded-md'
        }
      >
        {poster ? <img className="block size-full object-cover" src={poster} alt="" /> : null}
      </div>
      <div className={grid ? 'w-full' : undefined}>
        <h4 className="mt-0 mb-1.5 text-[15px] font-650 tracking-tightish">
          {movie.title}
          <AgeCaption rating={movie.certification} />
        </h4>
        <div className="flex flex-wrap items-center gap-x-1.5 text-xs leading-[1.45] text-muted tabular">
          {kind ? <span>{kind}</span> : null}
          <span>{kind ? `· ${movie.year ?? '—'}` : (movie.year ?? '—')}</span>
          {seasons ? <span>· {seasons}</span> : null}
          {runtime ? <span>· {runtime}</span> : null}
          <span className="inline-flex items-center gap-0.5">
            ·
            <IconStar className="size-3 text-faint" />
            {formatVotes(movie.voteCount)}
          </span>
        </div>
        {genres ? <div className="text-xs leading-[1.45] text-faint tabular">{genres}</div> : null}
      </div>
      <div className={cn('flex shrink-0', grid ? 'justify-start gap-5' : 'justify-end gap-4')}>
        <Stat value={movie.voteAverage.toFixed(1)} label="IMDb" compact={grid} />
        {match != null ? <Stat value={String(Math.round(match))} label="Match" accent compact={grid} /> : null}
      </div>
    </button>
  )
}

export function AgeCaption({ rating }: { rating?: string }): JSX.Element | null {
  if (!rating) return null
  return (
    <span className="ml-1.5 inline-block align-middle rounded-[4px] border border-line px-1 py-px text-[10px] font-650 tracking-[0.08em] text-muted [text-shadow:none]">
      {rating}
    </span>
  )
}

function Stat({
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
    <div className={cn('tabular', compact ? 'text-left' : 'text-right', accent && 'text-accent')}>
      <div className={cn('leading-none font-bold tracking-[-0.06em]', compact ? 'text-xl' : 'text-[22px]')}>{value}</div>
      <small className="mt-1 block text-[10px] font-semibold tracking-[0.14em] text-faint uppercase">{label}</small>
    </div>
  )
}
