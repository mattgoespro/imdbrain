import type { JSX } from 'react'
import type { MovieSummary, RankedMovie } from '../../../shared/types'
import { formatRuntime, posterUrl } from '../../../shared/types'

export default function MovieCard({
  movie,
  onOpen
}: {
  movie: MovieSummary | RankedMovie
  onOpen: (movie: MovieSummary) => void
}): JSX.Element {
  const poster = posterUrl(movie.posterPath)
  const match = 'match' in movie ? movie.match : null
  return (
    <button className="card" onClick={() => onOpen(movie)}>
      <div className="poster">
        {poster ? <img src={poster} alt="" /> : <div className="empty">{movie.title}</div>}
        {match != null ? <span className="badge">{Math.round(match)}%</span> : null}
        <span className="badge right">{movie.voteAverage.toFixed(1)}</span>
      </div>
      <div className="card-body">
        <h3 title={movie.title}>{movie.title}</h3>
        <div className="meta">
          <span>{[movie.year ?? '—', formatRuntime(movie.runtime)].filter(Boolean).join(' · ')}</span>
          <span>{formatVotes(movie.voteCount)}</span>
        </div>
      </div>
    </button>
  )
}

function formatVotes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${Math.round(n / 100) / 10}k`
  return `${n}`
}
