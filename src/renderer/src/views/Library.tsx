import { useMemo, useState, type JSX } from 'react'
import type { LibraryEntry, MovieSummary, WatchStatus } from '../../../shared/types'
import { posterUrl } from '../../../shared/types'

export default function Library({
  library,
  genreMap,
  onOpen,
  onChange
}: {
  library: LibraryEntry[]
  genreMap: Map<number, string>
  onOpen: (movie: MovieSummary) => void
  onChange: (library: LibraryEntry[]) => void
}): JSX.Element {
  const [tab, setTab] = useState<WatchStatus | 'all'>('watched')

  const rows = useMemo(() => {
    const filtered = tab === 'all' ? library : library.filter((e) => e.status === tab)
    return [...filtered].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.updatedAt.localeCompare(a.updatedAt))
  }, [library, tab])

  const avg = average(library.filter((e) => e.rating != null).map((e) => e.rating as number))
  const genreCounts = new Map<string, number>()
  for (const entry of library.filter((e) => e.status === 'watched')) {
    for (const id of entry.genreIds) {
      const name = genreMap.get(id) ?? 'Other'
      genreCounts.set(name, (genreCounts.get(name) ?? 0) + 1)
    }
  }
  const topGenres = [...genreCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)

  return (
    <section>
      <div className="page-head">
        <div>
          <h2>Watch patterns</h2>
          <p>
            Everything you rate, finish, save, or skip trains the ranker. Average score{' '}
            {avg ? avg.toFixed(1) : '—'}/10 across {library.filter((e) => e.rating != null).length} ratings.
          </p>
        </div>
      </div>
      <div className="insights">
        {topGenres.map(([name, count]) => (
          <div className="insight" key={name}>
            {name} shows up in {count} watched titles.
          </div>
        ))}
      </div>
      <div className="tabs">
        {(['watched', 'watchlist', 'skipped', 'all'] as const).map((id) => (
          <button key={id} className={`btn ${tab === id ? 'gold' : ''}`} onClick={() => setTab(id)}>
            {id}
          </button>
        ))}
      </div>
      {!rows.length ? (
        <div className="empty">
          <h3>Nothing in this shelf yet</h3>
          <p>Search for a movie you know well and give it a rating to start the pattern.</p>
        </div>
      ) : (
        <div className="ranked">
          {rows.map((entry) => (
            <div
              className="ranked-row"
              key={entry.tmdbId}
              onClick={() =>
                onOpen({
                  tmdbId: entry.tmdbId,
                  imdbId: entry.imdbId,
                  title: entry.title,
                  overview: entry.overview ?? '',
                  posterPath: entry.posterPath ?? null,
                  backdropPath: entry.backdropPath ?? null,
                  releaseDate: entry.releaseDate ?? '',
                  year: entry.year,
                  genreIds: entry.genreIds,
                  originalLanguage: entry.originalLanguage ?? '',
                  popularity: 0,
                  voteAverage: entry.voteAverage,
                  voteCount: entry.voteCount,
                  adult: false,
                  runtime: entry.runtime,
                  directorIds: entry.directorIds,
                  directorNames: entry.directorNames,
                  castIds: entry.castIds,
                  castNames: entry.castNames
                })
              }
            >
              <div className="rank-no">{entry.rating ?? '–'}</div>
              {posterUrl(entry.posterPath, 'w185') ? (
                <img src={posterUrl(entry.posterPath, 'w185') ?? ''} alt="" />
              ) : (
                <div className="thumb" />
              )}
              <div>
                <h3>{entry.title}</h3>
                <div className="meta">
                  {entry.year} · {entry.status} · {entry.genreIds.map((id) => genreMap.get(id)).filter(Boolean).slice(0, 3).join(', ')}
                </div>
              </div>
              <button
                className="btn ghost"
                onClick={async (event) => {
                  event.stopPropagation()
                  onChange(await window.api.removeLibrary(entry.tmdbId))
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function average(values: number[]): number {
  if (!values.length) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}
