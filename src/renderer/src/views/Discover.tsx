import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import type { DiscoverFilters, Genre, MovieSummary, RankedMovie } from '../../../shared/types'
import FilterPanel from '../components/FilterPanel'
import MovieCard from '../components/MovieCard'

const SEARCH_DEBOUNCE_MS = 400

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
  const [items, setItems] = useState<RankedMovie[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const requestId = useRef(0)
  const filtersRef = useRef(filters)
  filtersRef.current = filters

  const filterKey = useMemo(
    () =>
      JSON.stringify({
        ...filters,
        page: 1,
        withoutGenres: [],
        cast: [],
        directors: [],
        keywords: [],
        providers: []
      }),
    [filters]
  )

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void load(1, true)
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey])

  async function load(nextPage: number, replace: boolean): Promise<void> {
    const id = ++requestId.current
    if (replace) {
      setLoading(true)
      setLoadingMore(false)
    } else {
      setLoadingMore(true)
    }
    onError('')
    try {
      const data = await window.api.discover({ ...filtersRef.current, page: nextPage })
      if (id !== requestId.current) return
      setPage(nextPage)
      setTotalPages(Math.max(1, data.totalPages))
      setItems((prev) => {
        if (replace) return data.results
        const seen = new Set(prev.map((movie) => movie.tmdbId))
        return [...prev, ...data.results.filter((movie) => !seen.has(movie.tmdbId))]
      })
      if (replace) scrollerRef.current?.scrollTo({ top: 0 })
    } catch (error) {
      if (id !== requestId.current) return
      onError(error instanceof Error ? error.message : 'Search failed')
    } finally {
      if (id === requestId.current) {
        setLoading(false)
        setLoadingMore(false)
      }
    }
  }

  useEffect(() => {
    const sentinel = sentinelRef.current
    const root = scrollerRef.current
    if (!sentinel || !root) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return
        if (loading || loadingMore || page >= totalPages) return
        void load(page + 1, false)
      },
      { root, rootMargin: '280px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [page, totalPages, loading, loadingMore, items.length])

  return (
    <section className="discover">
      <div className="page-head">
        <div>
          <h2>Advanced search</h2>
          <p>Filter by title, genre, era, rating, runtime, and language. Results update as you edit.</p>
        </div>
      </div>
      <div className="layout-split">
        <FilterPanel filters={filters} setFilters={setFilters} genres={genres} />
        <div className="results-pane" ref={scrollerRef}>
          {loading && !items.length ? <div className="empty compact">Searching the catalog…</div> : null}
          {!loading && !items.length ? (
            <div className="empty compact">
              <h3>No titles in this slice</h3>
              <p>Loosen the vote floor or year window to see more films.</p>
            </div>
          ) : null}
          {items.length ? (
            <div className={`grid ${loading ? 'is-loading' : ''}`}>
              {items.map((movie) => (
                <MovieCard key={movie.tmdbId} movie={movie} onOpen={onOpen} />
              ))}
            </div>
          ) : null}
          <div ref={sentinelRef} className="scroll-sentinel" />
          {loadingMore ? <div className="pager">Loading more titles…</div> : null}
        </div>
      </div>
    </section>
  )
}
