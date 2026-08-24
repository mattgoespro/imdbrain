import { useEffect, useState, type JSX } from 'react'
import type { LibraryEntry, MovieDetails, MovieSummary, WatchStatus } from '../../../shared/types'
import {
  formatRuntime,
  formatSeasons,
  formatVotes,
  imdbUrl,
  posterUrl,
  titleKindLabel,
  type MediaType
} from '../../../shared/types'
import { AgeCaption } from './MovieCard'
import { cn } from '../lib/cn'
import { btn } from '../lib/ui'

function HeroPoster({ path }: { path: string | null }): JSX.Element {
  const thumb = posterUrl(path, 'w185')
  const hero = posterUrl(path, 'w780')
  const [src, setSrc] = useState(thumb)

  useEffect(() => {
    setSrc(thumb)
    if (!hero || hero === thumb) return
    let cancelled = false
    const img = new Image()
    img.onload = () => {
      if (!cancelled) setSrc(hero)
    }
    img.src = hero
    return () => {
      cancelled = true
    }
  }, [thumb, hero])

  if (!src) return <div className="hero-ph-fallback absolute inset-0" />
  return <img className="absolute inset-0 size-full object-cover object-top" src={src} alt="" />
}

function inspectorClass(docked?: boolean): string {
  return cn(
    'min-h-0 max-h-[34vh] overflow-auto border-t border-line bg-transparent p-0 inspect:max-h-none inspect:border-t-0 inspect:border-l',
    docked && 'max-inspect:col-start-2 max-inspect:max-h-[34vh]'
  )
}

export default function Inspector({
  movie,
  details,
  entry,
  match,
  genreMap,
  docked,
  onUpsert,
  onRemove
}: {
  movie: MovieSummary | null
  details: MovieDetails | null
  entry?: LibraryEntry
  match?: number | null
  genreMap: Map<number, string>
  docked?: boolean
  onUpsert: (movie: MovieSummary, status: WatchStatus, rating?: number) => Promise<void>
  onRemove: (tmdbId: number, mediaType: MediaType) => Promise<void>
}): JSX.Element {
  if (!movie) {
    return (
      <aside className={inspectorClass(docked)}>
        <div className="px-5 py-8 text-muted">
          <h3 className="mt-0 mb-2 text-lg tracking-[-0.03em] text-ink">Select a title</h3>
          <p>Ratings, watch status, and the IMDb page live here.</p>
        </div>
      </aside>
    )
  }

  const data =
    details?.tmdbId === movie.tmdbId && (details.mediaType ?? 'movie') === (movie.mediaType ?? 'movie')
      ? details
      : movie
  const imdb = imdbUrl(details?.imdbId ?? movie.imdbId ?? entry?.imdbId)
  const genres = (
    details?.genres?.map((g) => g.name) ??
    data.genreIds.map((id) => genreMap.get(id)).filter(Boolean)
  )
    .filter(Boolean)
    .slice(0, 4)
    .join(' · ')
  const runtime = formatRuntime(details?.runtime ?? movie.runtime)
  const seasons = formatSeasons(details?.seasonCount ?? movie.seasonCount)
  const matchValue = match ?? ('match' in movie ? (movie as { match?: number }).match : null)

  return (
    <aside className={inspectorClass(docked)}>
      <div className="hero-ph relative aspect-[2/3] w-full overflow-hidden">
        <HeroPoster key={data.posterPath ?? 'none'} path={data.posterPath} />
        <div className="hero-fade pointer-events-none absolute inset-x-0 bottom-0 h-[72px]" />
      </div>
      <div className="animate-fade px-4 pt-4 pb-[18px]" key={movie.tmdbId}>
        <h2 className="mt-0 mb-1.5 text-2xl font-650 tracking-title [text-shadow:0_10px_28px_rgba(0,0,0,0.95),0_2px_8px_rgba(0,0,0,0.8)]">
          {data.title}
          <AgeCaption rating={details?.certification ?? data.certification} />
        </h2>
        <div className="mb-3.5 text-xs leading-[1.45] text-muted tabular">
          {[titleKindLabel(data.titleKind), data.year, seasons, runtime, genres].filter(Boolean).join(' · ')}
        </div>
        {details?.tagline ? (
          <div className="mb-2.5 text-[13px] text-accent-2 italic">{details.tagline}</div>
        ) : null}
        <p className="mb-3.5 text-[13px] leading-[1.55] text-muted">{data.overview || 'No synopsis available.'}</p>
        <div className="mb-3.5 flex gap-5 border-b border-line pb-3.5">
          <div>
            <small className="mb-1 block text-[10px] tracking-[0.12em] text-faint uppercase">IMDb</small>
            <b className="tabular text-[22px] tracking-[-0.05em]">{data.voteAverage.toFixed(1)}</b>
          </div>
          {matchValue != null ? (
            <div>
              <small className="mb-1 block text-[10px] tracking-[0.12em] text-faint uppercase">Match</small>
              <b className="tabular text-[22px] tracking-[-0.05em]">{Math.round(matchValue)}%</b>
            </div>
          ) : null}
          <div>
            <small className="mb-1 block text-[10px] tracking-[0.12em] text-faint uppercase">Votes</small>
            <b className="tabular text-[22px] tracking-[-0.05em]">{formatVotes(data.voteCount)}</b>
          </div>
        </div>
        <div className="mb-3.5 flex gap-1">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              className={cn(
                'h-8 flex-1 rounded-lg border p-0 text-xs font-650 transition-[background,color] duration-140',
                entry?.rating != null && entry.rating >= n
                  ? 'border-accent bg-accent text-accent-ink'
                  : 'border-line bg-[rgba(8,8,10,0.4)] text-muted'
              )}
              onClick={() => onUpsert(details ?? movie, 'watched', n)}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          <button className={btn('primary')} type="button" onClick={() => onUpsert(details ?? movie, 'watched', entry?.rating)}>
            Watched
          </button>
          <button className={btn()} type="button" onClick={() => onUpsert(details ?? movie, 'watchlist')}>
            Watchlist
          </button>
          <button className={btn()} type="button" onClick={() => onUpsert(details ?? movie, 'skipped')}>
            Not for me
          </button>
          {entry ? (
            <button
              className={btn('danger')}
              type="button"
              onClick={() => onRemove(movie.tmdbId, movie.mediaType ?? 'movie')}
            >
              Remove
            </button>
          ) : null}
          {imdb ? (
            <a className={btn('link')} href={imdb} target="_blank" rel="noreferrer">
              Open on IMDb
            </a>
          ) : null}
        </div>
        {entry?.status ? (
          <div className="text-[11px] tracking-[0.08em] text-accent uppercase">In library: {entry.status}</div>
        ) : null}
        {details?.directors?.length ? (
          <p className="my-2 mb-3 text-xs leading-[1.45] text-muted tabular">
            {details.directors.map((d) => d.name).join(', ')}
          </p>
        ) : null}
        {details?.cast?.length ? (
          <div className="mt-2 flex gap-2.5 overflow-auto pb-2">
            {details.cast.slice(0, 8).map((person) => (
              <div className="min-w-[72px] text-[11px] text-muted" key={person.id}>
                {person.profilePath ? (
                  <img
                    className="block size-[72px] rounded-[10px] bg-poster object-cover"
                    src={posterUrl(person.profilePath, 'w185') ?? ''}
                    alt=""
                  />
                ) : (
                  <div className="grid size-[72px] place-items-center rounded-[10px] bg-poster">{person.name.slice(0, 1)}</div>
                )}
                <b className="mt-1.5 block text-[11px] font-semibold text-ink">{person.name}</b>
                <div>{person.character}</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </aside>
  )
}

