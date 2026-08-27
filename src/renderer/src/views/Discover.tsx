import { useEffect, useMemo, useRef, useState, type JSX, type ReactNode } from 'react'
import type { DiscoverFilters, Genre, MovieSummary, RankedMovie } from '../../../shared/types'
import { applyMovieEnrichment, sortMovies, titleKey } from '../../../shared/types'
import FilterPanel from '../components/filter-panel'
import MovieCard from '../components/movie-card'
import OverlayScroll from '../components/overlay-scroll'
import CatalogLoader from '../components/catalog-loader'
import { IconGrid, IconList } from '../components/icons'
import { enterDelayMs, gridColumnCount } from '../motion'
import { cn } from '../lib/cn'

const SEARCH_DEBOUNCE_MS = 400

export default function Discover({
  filters,
  setFilters,
  genres,
  genreMap,
  selectedId,
  onOpen,
  onError,
  inspector
}: {
  filters: DiscoverFilters
  setFilters: (filters: DiscoverFilters) => void
  genres: Genre[]
  genreMap: Map<number, string>
  selectedId: string | null
  onOpen: (movie: MovieSummary) => void
  onError: (message: string) => void
  inspector: ReactNode
}): JSX.Element {
  const [items, setItems] = useState<RankedMovie[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalResults, setTotalResults] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [entering, setEntering] = useState(false)
  const [layout, setLayout] = useState<'list' | 'grid'>('list')
  const [gridCols, setGridCols] = useState(1)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const requestId = useRef(0)
  const filtersRef = useRef(filters)
  const loadingMoreRef = useRef(false)
  const selectedIdRef = useRef(selectedId)
  filtersRef.current = filters
  selectedIdRef.current = selectedId

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
    setLoading(true)
    const handle = window.setTimeout(() => {
      void load(1, true)
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey])

  async function load(nextPage: number, replace: boolean): Promise<void> {
    if (!replace && loadingMoreRef.current) return
    const id = ++requestId.current
    const sortBy = filtersRef.current.sortBy
    if (replace) {
      loadingMoreRef.current = false
      setLoading(true)
      setLoadingMore(false)
    } else {
      loadingMoreRef.current = true
      setLoadingMore(true)
    }
    onError('')
    try {
      const data = await window.api.discover({ ...filtersRef.current, page: nextPage })
      if (id !== requestId.current) return
      setPage(data.page)
      setTotalPages(Math.max(1, data.totalPages))
      setTotalResults(data.totalResults)
      setItems((prev) => {
        const incoming = data.results
        if (replace) return sortMovies(incoming, sortBy)
        const seen = new Set(prev.map((movie) => movie.tmdbId))
        return sortMovies(
          [...prev, ...incoming.filter((movie) => !seen.has(movie.tmdbId))],
          sortBy
        )
      })
      void applyMovieMeta(id, data.results)
      if (replace) {
        scrollerRef.current?.scrollTo({ top: 0 })
        const first = sortMovies(data.results, sortBy)[0]
        if (first) onOpen(first)
        setEntering(true)
      }
    } catch (error) {
      if (id !== requestId.current) return
      onError(error instanceof Error ? error.message : 'Search failed')
    } finally {
      if (id === requestId.current) {
        loadingMoreRef.current = false
        setLoading(false)
        setLoadingMore(false)
      }
    }
  }

  async function applyMovieMeta(id: number, movies: RankedMovie[]): Promise<void> {
    if (!movies.length) return
    try {
      const extra = await window.api.movieMeta(movies)
      if (id !== requestId.current) return
      let selectedUpdate: RankedMovie | undefined
      setItems((prev) => {
        const next = sortMovies(
          prev.map((movie) => {
            const patch = extra[titleKey(movie)]
            if (!patch) return movie
            return applyMovieEnrichment(movie, patch)
          }),
          filtersRef.current.sortBy
        )
        selectedUpdate = next.find((movie) => titleKey(movie) === selectedIdRef.current)
        return next
      })
      if (selectedUpdate) onOpen(selectedUpdate)
    } catch {
      /* list captions stay empty until the next search */
    }
  }

  useEffect(() => {
    if (!entering) return
    const handle = window.setTimeout(() => setEntering(false), 640)
    return () => window.clearTimeout(handle)
  }, [entering])

  useEffect(() => {
    if (layout !== 'grid') {
      setGridCols(1)
      return
    }
    const el = scrollerRef.current
    if (!el) return
    const read = (): void => setGridCols(gridColumnCount(el))
    read()
    const observer = new ResizeObserver(read)
    observer.observe(el)
    return () => observer.disconnect()
  }, [layout, items.length, entering])

  useEffect(() => {
    const sentinel = sentinelRef.current
    const root = scrollerRef.current
    if (!sentinel || !root) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return
        if (loading || loadingMoreRef.current || page >= totalPages) return
        void load(page + 1, false)
      },
      { root, rootMargin: '280px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [page, totalPages, loading, loadingMore, items.length])

  const refreshing = loading && items.length > 0
  const countLabel = titleCount(totalResults, loading && !items.length)
  const sortedItems = useMemo(() => sortMovies(items, filters.sortBy), [items, filters.sortBy])

  return (
    <section className="grid h-full min-h-0 flex-1 grid-cols-1 grid-rows-[auto_1fr_auto] inspect:grid-cols-[280px_minmax(0,1fr)_minmax(280px,400px)] inspect:grid-rows-none">
      <FilterPanel filters={filters} setFilters={setFilters} genres={genres} />
      <div className="flex min-h-0 min-w-0 flex-col pt-5 pr-0 pb-4 pl-[18px]">
        <div className="mb-2 flex items-center justify-between gap-3 pr-[18px]">
          <h2 className="m-0 text-[22px] font-650 tracking-title">
            Results
            <span className="ml-2 text-xs font-medium text-muted">{countLabel}</span>
          </h2>
          <div className="flex items-center gap-2.5">
            <div className="flex overflow-hidden rounded-lg border border-line" role="group" aria-label="Result layout">
              <button
                type="button"
                className={cn(
                  'grid h-7.5 w-8.5 place-items-center border-0 p-0',
                  layout === 'list' ? 'bg-accent-soft text-accent' : 'bg-transparent text-muted'
                )}
                aria-label="List view"
                title="List"
                onClick={() => setLayout('list')}
              >
                <IconList className="size-3.75" />
              </button>
              <button
                type="button"
                className={cn(
                  'grid h-7.5 w-8.5 place-items-center border-0 p-0',
                  layout === 'grid' ? 'bg-accent-soft text-accent' : 'bg-transparent text-muted'
                )}
                aria-label="Grid view"
                title="Grid"
                onClick={() => setLayout('grid')}
              >
                <IconGrid className="size-3.75" />
              </button>
            </div>
          </div>
        </div>
        <div className="relative flex min-h-0 flex-1 flex-col">
          <OverlayScroll
            ref={scrollerRef}
            className={cn(
              layout === 'grid'
                ? 'grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] content-start gap-x-3.5 gap-y-4.5 pr-[var(--rail-gutter,14px)]'
                : 'flex flex-col',
              refreshing && 'opacity-45'
            )}
          >
            {loading && !items.length ? <CatalogLoader label="Searching the catalog…" /> : null}
            {!loading && !items.length ? (
              <div className="col-span-full px-4 py-6 text-center text-muted">
                <h3 className="mt-0 mb-2 text-lg tracking-[-0.03em] text-ink">No titles in this slice</h3>
                <p>Loosen the vote floor or year window to see more films.</p>
              </div>
            ) : null}
            {sortedItems.map((movie, index) => (
              <MovieCard
                key={titleKey(movie)}
                movie={movie}
                genreMap={genreMap}
                active={selectedId === titleKey(movie)}
                layout={layout}
                entering={entering}
                enterDelay={enterDelayMs(index, layout === 'grid' ? gridCols : 1, layout === 'grid' ? 36 : 18)}
                onOpen={onOpen}
              />
            ))}
            <div ref={sentinelRef} className="col-span-full h-px" />
            {loadingMore ? (
              <div className="col-span-full my-4 mb-2 flex items-center justify-center gap-2.5 text-xs text-muted">
                Loading more titles…
              </div>
            ) : null}
          </OverlayScroll>
          {refreshing ? (
            <div className="pointer-events-none absolute inset-0 z-[3] grid place-items-center bg-canvas/42">
              <CatalogLoader label="Updating results…" />
            </div>
          ) : null}
        </div>
      </div>
      {inspector}
    </section>
  )
}

function titleCount(total: number, searching: boolean): string {
  if (searching && total <= 0) return 'Searching…'
  if (total <= 0) return 'No titles'
  return `${total.toLocaleString()} titles`
}
