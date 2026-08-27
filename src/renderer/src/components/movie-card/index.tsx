import type { CSSProperties, JSX } from 'react'
import type { MovieSummary, RankedMovie } from '../../../../shared/types'
import {
  formatRuntime,
  formatSeasons,
  posterUrl,
  titleKindLabel
} from '../../../../shared/types'
import { cn } from '../../lib/cn'
import Caption from './caption'
import GenreCaption from './genre-caption'
import Poster from './poster'
import Stats from './stats'
import Title from './title'

export { default as AgeCaption } from './age-caption'

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
  const kind =
    movie.titleKind && movie.titleKind !== 'movie'
      ? titleKindLabel(movie.titleKind)
      : null

  return (
    <button
      className={cn(
        grid
          ? 'flex w-full flex-col items-stretch gap-2 rounded-none border-0 bg-transparent p-0 pb-2 text-left text-inherit shadow-none'
          : 'mr-(--rail-gutter,14px) grid w-auto grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3 rounded-none border-0 border-b border-line bg-transparent py-2.5 pr-2.5 pl-1.5 text-left text-inherit transition-[background,box-shadow] duration-140',
        !grid && !active && 'hover:bg-white/3',
        !grid && active && 'inset-accent bg-accent-soft',
        entering && 'animate-result-in enter-delay'
      )}
      type="button"
      style={{ '--enter-delay': `${enterDelay}ms` } as CSSProperties}
      onClick={() => onOpen(movie)}
    >
      <Poster src={poster} grid={grid} active={active} />
      <div className={grid ? 'w-full' : undefined}>
        <Title title={movie.title} rating={movie.certification} />
        <Caption
          kind={kind}
          year={movie.year}
          seasons={seasons}
          runtime={runtime}
          voteCount={movie.voteCount}
        />
        <GenreCaption genres={genres} />
      </div>
      <Stats voteAverage={movie.voteAverage} match={match} compact={grid} />
    </button>
  )
}
