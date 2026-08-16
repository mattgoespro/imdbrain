import type { JSX } from 'react'
import type { DiscoverFilters, Genre } from '../../../shared/types'
import { LANGUAGES, SORT_OPTIONS, defaultFilters, formatRuntime } from '../../../shared/types'
import DualRange from './DualRange'

const RUNTIME_FLOOR = 0
const RUNTIME_CEILING = 240
const RUNTIME_STEP = 5

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
    <aside className="panel filters">
      <div className="filters-head">
        <h3>Advanced filters</h3>
        <button className="btn ghost" type="button" onClick={() => setFilters(defaultFilters())}>
          Reset
        </button>
      </div>
      <label className="field">
        Title or IMDb ID
        <input
          type="text"
          value={filters.query}
          placeholder="Heat, or tt0113277"
          onChange={(e) => patch({ query: e.target.value })}
        />
      </label>
      <label className="field">
        Sort
        <select value={filters.sortBy} onChange={(e) => patch({ sortBy: e.target.value })}>
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      <div className="field field-genres">
        Genres
        <p className="field-hint">
          {filters.genres.length
            ? 'Match any selected genre.'
            : 'None selected — all genres included.'}
        </p>
        <div className="pills">
          {genres.map((genre) => (
            <button
              type="button"
              key={genre.id}
              className={`pill ${filters.genres.includes(genre.id) ? 'on' : ''}`}
              onClick={() => toggleGenre(genre.id)}
            >
              {genre.name}
            </button>
          ))}
        </div>
      </div>
      <div className="row-2">
        <label className="field">
          From year
          <input
            type="number"
            value={filters.yearMin ?? ''}
            onChange={(e) => patch({ yearMin: num(e.target.value) })}
          />
        </label>
        <label className="field">
          To year
          <input
            type="number"
            value={filters.yearMax ?? ''}
            onChange={(e) => patch({ yearMax: num(e.target.value) })}
          />
        </label>
      </div>
      <label className="field">
        Minimum rating {filters.ratingMin.toFixed(1)}
        <div className="range">
          <input
            type="range"
            min={0}
            max={9}
            step={0.5}
            value={filters.ratingMin}
            onChange={(e) => patch({ ratingMin: Number(e.target.value) })}
          />
        </div>
      </label>
      <label className="field">
        Minimum votes {filters.voteCountMin}
        <div className="range">
          <input
            type="range"
            min={0}
            max={5000}
            step={50}
            value={filters.voteCountMin}
            onChange={(e) => patch({ voteCountMin: Number(e.target.value) })}
          />
        </div>
      </label>
      <label className="field">
        Runtime {runtimeCaption(filters.runtimeMin, filters.runtimeMax)}
        <DualRange
          min={RUNTIME_FLOOR}
          max={RUNTIME_CEILING}
          step={RUNTIME_STEP}
          valueMin={filters.runtimeMin ?? RUNTIME_FLOOR}
          valueMax={filters.runtimeMax ?? RUNTIME_CEILING}
          onChange={(nextMin, nextMax) =>
            patch({
              runtimeMin: nextMin <= RUNTIME_FLOOR ? null : nextMin,
              runtimeMax: nextMax >= RUNTIME_CEILING ? null : nextMax
            })
          }
        />
      </label>
      <label className="field">
        Original language
        <select value={filters.language} onChange={(e) => patch({ language: e.target.value })}>
          {LANGUAGES.map((lang) => (
            <option key={lang.code || 'any'} value={lang.code}>
              {lang.label}
            </option>
          ))}
        </select>
      </label>
      <div className="filter-checks">
        <label className="check">
          <input
            type="checkbox"
            checked={filters.hideWatched}
            onChange={(e) => patch({ hideWatched: e.target.checked })}
          />
          Hide watched
        </label>
        <label className="check">
          <input
            type="checkbox"
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

function labelMinutes(minutes: number): string {
  if (minutes <= 0) return '0m'
  return formatRuntime(minutes) ?? `${minutes}m`
}

function num(value: string): number | null {
  if (value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}
