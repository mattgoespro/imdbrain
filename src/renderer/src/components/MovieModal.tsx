import type { JSX } from 'react'
import type { LibraryEntry, MovieDetails, MovieSummary, WatchStatus } from '../../../shared/types'
import { imdbUrl, posterUrl } from '../../../shared/types'

export default function MovieModal({
  movie,
  details,
  entry,
  genreMap,
  onClose,
  onUpsert,
  onRemove
}: {
  movie: MovieSummary
  details: MovieDetails | null
  entry?: LibraryEntry
  genreMap: Map<number, string>
  onClose: () => void
  onUpsert: (movie: MovieSummary, status: WatchStatus, rating?: number) => Promise<void>
  onRemove: (tmdbId: number) => Promise<void>
}): JSX.Element {
  const data = details ?? movie
  const poster = posterUrl(data.posterPath, 'w342')
  const backdrop = posterUrl(data.backdropPath, 'w780')
  const imdb = imdbUrl(details?.imdbId ?? movie.imdbId ?? entry?.imdbId)
  const genres = (details?.genres?.map((g) => g.name) ?? data.genreIds.map((id) => genreMap.get(id)).filter(Boolean)).join(
    ' · '
  )

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="hero">
          {backdrop ? <img className="backdrop" src={backdrop} alt="" /> : null}
          <div className="hero-content">
            {poster ? <img className="poster-lg" src={poster} alt="" /> : <div className="poster-lg" />}
            <div>
              <h2>{data.title}</h2>
              <div className="meta">
                <span>{[data.year, details?.runtime ? `${details.runtime} min` : null, genres].filter(Boolean).join('  ·  ')}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="modal-body">
          {details?.tagline ? <div className="tagline">{details.tagline}</div> : null}
          <p className="overview">{data.overview || 'No synopsis available.'}</p>
          <div className="kvs">
            <div>
              <small>Public rating</small>
              <b>{data.voteAverage.toFixed(1)} / 10</b>
            </div>
            <div>
              <small>Votes</small>
              <b>{data.voteCount.toLocaleString()}</b>
            </div>
            <div>
              <small>Directors</small>
              <b>{details?.directors.map((d) => d.name).join(', ') || '—'}</b>
            </div>
            <div>
              <small>Your rating</small>
              <b>{entry?.rating ? `${entry.rating}/10` : 'Unrated'}</b>
            </div>
          </div>
          <div className="field">
            Rate this title
            <div className="stars">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  className={entry?.rating && entry.rating >= n ? 'on' : ''}
                  onClick={() => onUpsert(details ?? movie, 'watched', n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="actions">
            <button className="btn gold" onClick={() => onUpsert(details ?? movie, 'watched', entry?.rating)}>
              Mark watched
            </button>
            <button className="btn" onClick={() => onUpsert(details ?? movie, 'watchlist')}>
              Watchlist
            </button>
            <button className="btn" onClick={() => onUpsert(details ?? movie, 'skipped')}>
              Not for me
            </button>
            {entry ? (
              <button className="btn danger" onClick={() => onRemove(movie.tmdbId)}>
                Remove
              </button>
            ) : null}
            {imdb ? (
              <a className="btn" href={imdb} target="_blank" rel="noreferrer">
                Open on IMDb
              </a>
            ) : null}
            <button className="btn ghost" onClick={onClose}>
              Close
            </button>
          </div>
          {entry?.status ? <div className="status-tag">In library: {entry.status}</div> : null}
          {details?.cast?.length ? (
            <>
              <h3 style={{ marginTop: 18 }}>Cast</h3>
              <div className="cast-row">
                {details.cast.slice(0, 12).map((person) => (
                  <div className="cast-card" key={person.id}>
                    {person.profilePath ? (
                      <img src={posterUrl(person.profilePath, 'w185') ?? ''} alt="" />
                    ) : (
                      <div className="cast-ph">{person.name.slice(0, 1)}</div>
                    )}
                    <b>{person.name}</b>
                    <div>{person.character}</div>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
