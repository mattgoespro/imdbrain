import type { JSX } from 'react'
import type { DiscoverFilters, Genre } from '../../../shared/types'
import {
  LANGUAGES,
  SORT_OPTIONS,
  TITLE_KIND_OPTIONS,
  defaultFilters,
  formatRuntime,
  mediaTypeOf,
  type TitleKind
} from '../../../shared/types'
import DualRange from './DualRange'
import Select from './Select'
import { cn } from '../lib/cn'
import { btn, rangeInputClass } from '../lib/ui'

const RUNTIME_FLOOR = 0
const RUNTIME_CEILING = 240
const RUNTIME_STEP = 5
const YEAR_FLOOR = 1900
const YEAR_CEILING = new Date().getFullYear()
const YEAR_STEP = 1

export default function FilterPanel({
  filters,
  setFilters,
  genres
}: {
  filters: DiscoverFilters
  setFilters: (filters: DiscoverFilters) => void
  genres: Genre[]
}): JSX.Element {
  function patch(partial: Partial<DiscoverFilters>): void {
    setFilters({ ...filters, ...partial, page: 1 })
  }

  function toggleGenre(id: number): void {
    patch({
      genres: filters.genres.includes(id)
        ? filters.genres.filter((genreId) => genreId !== id)
        : [...filters.genres, id],
      withoutGenres: []
    })
  }

  return (
    <aside className="flex min-h-0 max-h-[28vh] flex-col gap-2.5 overflow-auto border-b border-line bg-transparent px-4.5 py-5 inspect:max-h-none inspect:border-r inspect:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <h3 className="kicker">Filters</h3>
        <button className={btn('ghost')} type="button" onClick={() => setFilters(defaultFilters())}>
          Reset
        </button>
      </div>
      <label className="mb-1 flex min-w-0 flex-col gap-1.5 text-xs font-medium text-muted">
        Title or IMDb ID
        <input
          type="text"
          value={filters.query}
          placeholder="Heat, or tt0113277"
          onChange={(e) => patch({ query: e.target.value })}
        />
      </label>
      <label className="mb-1 flex min-w-0 flex-col gap-1.5 text-xs font-medium text-muted">
        Title type
        <Select
          value={filters.titleKind}
          ariaLabel="Title type"
          options={TITLE_KIND_OPTIONS}
          onChange={(titleKind) =>
            patch({
              titleKind: titleKind as TitleKind,
              genres: [],
              sortBy:
                titleKind !== 'movie' && filters.sortBy === 'revenue.desc' ? 'popularity.desc' : filters.sortBy
            })
          }
        />
      </label>
      <label className="mb-1 flex min-w-0 flex-col gap-1.5 text-xs font-medium text-muted">
        Sort
        <Select
          value={filters.sortBy}
          ariaLabel="Sort"
          options={
            mediaTypeOf(filters.titleKind) === 'tv'
              ? SORT_OPTIONS.filter((option) => option.value !== 'revenue.desc')
              : SORT_OPTIONS
          }
          onChange={(sortBy) => patch({ sortBy })}
        />
      </label>
      <div className="mb-1 flex min-w-0 flex-col gap-1.5 text-xs font-medium text-muted">
        Genres
        <p className="m-0 text-[11px] leading-[1.3] text-faint">
          {filters.genres.length
            ? 'Match any selected genre.'
            : 'None selected — all genres included.'}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {genres.map((genre) => (
            <button
              type="button"
              key={genre.id}
              className={cn(
                'rounded-full border px-2.5 py-1 text-[11px] leading-[1.2] font-semibold whitespace-nowrap transition-[background,color,border-color] duration-140',
                filters.genres.includes(genre.id)
                  ? 'border-accent bg-accent text-accent-ink'
                  : 'border-line bg-white/3 text-muted'
              )}
              onClick={() => toggleGenre(genre.id)}
            >
              {genre.name}
            </button>
          ))}
        </div>
      </div>
      <label className="mb-1 flex min-w-0 flex-col gap-1.5 text-xs font-medium text-muted">
        Years {yearCaption(filters.yearMin, filters.yearMax)}
        <DualRange
          min={YEAR_FLOOR}
          max={YEAR_CEILING}
          step={YEAR_STEP}
          valueMin={filters.yearMin ?? YEAR_FLOOR}
          valueMax={filters.yearMax ?? YEAR_CEILING}
          minLabel="From year"
          maxLabel="To year"
          onChange={(nextMin, nextMax) =>
            patch({
              yearMin: nextMin <= YEAR_FLOOR ? null : nextMin,
              yearMax: nextMax >= YEAR_CEILING ? null : nextMax
            })
          }
        />
      </label>
      <label className="mb-1 flex min-w-0 flex-col gap-1.5 text-xs font-medium text-muted">
        Minimum rating {filters.ratingMin.toFixed(1)}
        <div className="flex min-w-0 items-center gap-2">
          <input
            type="range"
            className={rangeInputClass}
            min={0}
            max={9}
            step={0.5}
            value={filters.ratingMin}
            onChange={(e) => patch({ ratingMin: Number(e.target.value) })}
          />
        </div>
      </label>
      <label className="mb-1 flex min-w-0 flex-col gap-1.5 text-xs font-medium text-muted">
        Minimum votes {filters.voteCountMin}
        <div className="flex min-w-0 items-center gap-2">
          <input
            type="range"
            className={rangeInputClass}
            min={0}
            max={5000}
            step={50}
            value={filters.voteCountMin}
            onChange={(e) => patch({ voteCountMin: Number(e.target.value) })}
          />
        </div>
      </label>
      <label className="mb-1 flex min-w-0 flex-col gap-1.5 text-xs font-medium text-muted">
        {mediaTypeOf(filters.titleKind) === 'tv' ? 'Episode length' : 'Runtime'}{' '}
        {runtimeCaption(filters.runtimeMin, filters.runtimeMax)}
        <DualRange
          min={RUNTIME_FLOOR}
          max={RUNTIME_CEILING}
          step={RUNTIME_STEP}
          valueMin={filters.runtimeMin ?? RUNTIME_FLOOR}
          valueMax={filters.runtimeMax ?? RUNTIME_CEILING}
          minLabel="Minimum runtime"
          maxLabel="Maximum runtime"
          onChange={(nextMin, nextMax) =>
            patch({
              runtimeMin: nextMin <= RUNTIME_FLOOR ? null : nextMin,
              runtimeMax: nextMax >= RUNTIME_CEILING ? null : nextMax
            })
          }
        />
      </label>
      <label className="mb-1 flex min-w-0 flex-col gap-1.5 text-xs font-medium text-muted">
        Original language
        <Select
          value={filters.language}
          ariaLabel="Original language"
          options={LANGUAGES.map((lang) => ({ value: lang.code, label: lang.label }))}
          onChange={(language) => patch({ language })}
        />
      </label>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        <label className="mt-1 flex items-center gap-2 text-[13px] text-muted">
          <input
            type="checkbox"
            className="accent-accent"
            checked={filters.hideWatched}
            onChange={(e) => patch({ hideWatched: e.target.checked })}
          />
          Hide watched
        </label>
        <label className="mt-1 flex items-center gap-2 text-[13px] text-muted">
          <input
            type="checkbox"
            className="accent-accent"
            checked={filters.hideWatchlist}
            onChange={(e) => patch({ hideWatchlist: e.target.checked })}
          />
          Hide watchlist
        </label>
      </div>
    </aside>
  )
}

function runtimeCaption(min: number | null, max: number | null): string {
  const low = min ?? RUNTIME_FLOOR
  const high = max ?? RUNTIME_CEILING
  if (low <= RUNTIME_FLOOR && high >= RUNTIME_CEILING) return '· any length'
  if (low <= RUNTIME_FLOOR) return `· up to ${labelMinutes(high)}`
  if (high >= RUNTIME_CEILING) return `· ${labelMinutes(low)}+`
  return `· ${labelMinutes(low)} – ${labelMinutes(high)}`
}

function yearCaption(min: number | null, max: number | null): string {
  const low = min ?? YEAR_FLOOR
  const high = max ?? YEAR_CEILING
  if (low <= YEAR_FLOOR && high >= YEAR_CEILING) return '· any year'
  if (low === high) return `· ${low}`
  return `· ${low} – ${high}`
}

function labelMinutes(minutes: number): string {
  if (minutes <= 0) return '0m'
  return formatRuntime(minutes) ?? `${minutes}m`
}
