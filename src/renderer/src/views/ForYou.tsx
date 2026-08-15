import { useEffect, useState, type JSX } from 'react'
import type { ForYouResult, MovieSummary, RankingMode, TasteProfile } from '../../../shared/types'
import { posterUrl } from '../../../shared/types'

export default function ForYou({
  profile,
  genreMap,
  onOpen,
  onError,
  rankingMode
}: {
  profile: TasteProfile | null
  genreMap: Map<number, string>
  onOpen: (movie: MovieSummary) => void
  onError: (message: string) => void
  rankingMode: RankingMode
}): JSX.Element {
  const [result, setResult] = useState<ForYouResult | null>(null)
  const [loading, setLoading] = useState(false)

  async function load(): Promise<void> {
    setLoading(true)
    onError('')
    try {
      setResult(await window.api.forYou())
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not build rankings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [rankingMode])

  const ready = (result?.profile ?? profile)?.ready

  return (
    <section>
      <div className="page-head">
        <div>
          <h2>Ranked for you</h2>
          <p>
            Seeded from movies you rated highly, then re-ranked with genre affinity, directors, cast,
            era, runtime habits, and how you have been watching lately.
          </p>
        </div>
        <div className="toolbar">
          <button className="btn gold" onClick={() => void load()} disabled={loading}>
            {loading ? 'Ranking…' : 'Refresh ranking'}
          </button>
        </div>
      </div>

      {!ready ? (
        <div className="empty">
          <h3>Your taste model needs a few ratings</h3>
          <p>
            Rate at least three watched movies (or import your IMDb ratings.csv in Settings). Until then,
            rankings lean on public scores instead of your patterns.
          </p>
        </div>
      ) : null}

      <div className="insights">
        {(result?.insights ?? []).map((text) => (
          <div className="insight" key={text}>
            {text}
          </div>
        ))}
        {(result?.profile.topGenres ?? profile?.topGenres ?? []).slice(0, 3).map((genre) => (
          <div className="insight" key={genre.id}>
            {genreMap.get(Number(genre.id)) ?? genre.name}: avg {genre.avg} across {genre.count} rated
            titles.
          </div>
        ))}
      </div>

      {loading ? <div className="empty">Learning from your watch pattern…</div> : null}

      <div className="ranked">
        {result?.movies.map((movie, index) => (
          <button className="ranked-row" key={movie.tmdbId} onClick={() => onOpen(movie)}>
            <div className="rank-no">{String(index + 1).padStart(2, '0')}</div>
            {posterUrl(movie.posterPath, 'w185') ? (
              <img src={posterUrl(movie.posterPath, 'w185') ?? ''} alt="" />
            ) : (
              <div className="thumb" />
            )}
            <div>
              <h3>
                {movie.title} <span className="meta">{movie.year}</span>
              </h3>
              <div className="meta">Public {movie.voteAverage.toFixed(1)} · {movie.overview.slice(0, 140)}{movie.overview.length > 140 ? '…' : ''}</div>
              <div className="reasons">
                {movie.reasons.map((reason) => (
                  <span className="reason" key={reason.label}>
                    {reason.label}: {reason.detail}
                  </span>
                ))}
              </div>
            </div>
            <div className="match-lg">
              {Math.round(movie.match)}
              <small>match</small>
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}
