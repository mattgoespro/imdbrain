import { useEffect, useState, type JSX } from 'react'
import type { DiscoverFilters, Genre, MovieSummary, PagedMovies } from '../../../shared/types'
import FilterPanel from '../components/FilterPanel'
import MovieCard from '../components/MovieCard'

export default function Discover({
  filters,
  setFilters,
  genres,
  onOpen,
  onError
}: {
  filters: DiscoverFilters
  setFilters: (filters: DiscoverFilters) => void
  genres: Genre[]
  onOpen: (movie: MovieSummary) => void
  onError: (message: string) => void
}): JSX.Element {
  const [data, setData] = useState<PagedMovies | null>(null)
  const [loading, setLoading] = useState(false)

  async function run(next = filters): Promise<void> {
    setLoading(true)
    onError('')
    try {
      setData(await window.api.discover(next))
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void run()
    // initial catalog load only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function page(delta: number): void {
    const next = { ...filters, page: Math.max(1, filters.page + delta) }
    setFilters(next)
    void run(next)
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <h2>Advanced search</h2>
          <p>
            Filter the IMDb-linked catalog by genre, era, people, keywords, runtime, votes, and streaming.
            Sort by public rating or by how closely a title matches your taste.
          </p>
        </div>
      </div>
      <div className="layout-split">
        <FilterPanel filters={filters} setFilters={setFilters} genres={genres} onSearch={() => void run(filters)} />
        <div>
          {loading ? <div className="empty">Searching the catalog…</div> : null}
          {!loading && data && !data.results.length ? (
            <div className="empty">
              <h3>No titles in this slice</h3>
              <p>Loosen the vote floor or year window and run the search again.</p>
            </div>
          ) : null}
          <div className="grid">
            {data?.results.map((movie) => (
              <MovieCard key={movie.tmdbId} movie={movie} onOpen={onOpen} />
            ))}
          </div>
          {data && data.totalPages > 1 ? (
            <div className="pager">
              <button className="btn" disabled={filters.page <= 1} onClick={() => page(-1)}>
                Previous
              </button>
              <span>
                Page {filters.page} of {data.totalPages}
              </span>
              <button className="btn" disabled={filters.page >= data.totalPages} onClick={() => page(1)}>
                Next
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
