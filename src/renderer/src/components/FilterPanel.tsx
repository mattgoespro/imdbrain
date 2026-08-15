import { useEffect, useState, type JSX } from 'react'
import type { DiscoverFilters, Genre, WatchProvider } from '../../../shared/types'
import { LANGUAGES, SORT_OPTIONS, defaultFilters } from '../../../shared/types'
import SuggestField, { keywordSearch, personSearch } from './SuggestField'

export default function FilterPanel({
  filters,
  setFilters,
  genres,
  onSearch
}: {
  filters: DiscoverFilters
  setFilters: (filters: DiscoverFilters) => void
  genres: Genre[]
  onSearch: () => void
}): JSX.Element {
  const [providers, setProviders] = useState<WatchProvider[]>([])

  useEffect(() => {
    window.api.providers().then(setProviders).catch(() => setProviders([]))
  }, [])

  function patch(partial: Partial<DiscoverFilters>): void {
    setFilters({ ...filters, ...partial, page: 1 })
  }

  function toggle(list: number[], id: number): number[] {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
  }

  return (
    <form
      className="panel filters"
      onSubmit={(e) => {
        e.preventDefault()
        onSearch()
      }}
    >
      <h3>Advanced filters</h3>
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
      <div className="field">
        Include genres
        <div className="pills">
          {genres.map((genre) => (
            <button
              type="button"
              key={genre.id}
              className={`pill ${filters.genres.includes(genre.id) ? 'on' : ''}`}
              onClick={() => patch({ genres: toggle(filters.genres, genre.id) })}
            >
              {genre.name}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        Exclude genres
        <div className="pills">
          {genres.slice(0, 12).map((genre) => (
            <button
              type="button"
              key={genre.id}
              className={`pill dim ${filters.withoutGenres.includes(genre.id) ? 'on' : ''}`}
              onClick={() => patch({ withoutGenres: toggle(filters.withoutGenres, genre.id) })}
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
      <div className="row-2">
        <label className="field">
          Min runtime
          <input
            type="number"
            placeholder="mins"
            value={filters.runtimeMin ?? ''}
            onChange={(e) => patch({ runtimeMin: num(e.target.value) })}
          />
        </label>
        <label className="field">
          Max runtime
          <input
            type="number"
            placeholder="mins"
            value={filters.runtimeMax ?? ''}
            onChange={(e) => patch({ runtimeMax: num(e.target.value) })}
          />
        </label>
      </div>
      <label className="field">
        Original language
        <select value={filters.language} onChange={(e) => patch({ language: e.target.value })}>
          {LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.label}
            </option>
          ))}
        </select>
      </label>
      <SuggestField
        label="Cast"
        placeholder="Actor or actress"
        values={filters.cast}
        onChange={(cast) => patch({ cast })}
        search={personSearch}
      />
      <SuggestField
        label="Director"
        placeholder="Director name"
        values={filters.directors}
        onChange={(directors) => patch({ directors })}
        search={personSearch}
      />
      <SuggestField
        label="Keywords"
        placeholder="heist, neo-noir…"
        values={filters.keywords}
        onChange={(keywords) => patch({ keywords })}
        search={keywordSearch}
      />
      {providers.length ? (
        <div className="field">
          Streaming (US)
          <div className="pills">
            {providers.slice(0, 16).map((provider) => (
              <button
                type="button"
                key={provider.provider_id}
                className={`pill ${filters.providers.includes(provider.provider_id) ? 'on' : ''}`}
                onClick={() => patch({ providers: toggle(filters.providers, provider.provider_id) })}
              >
                {provider.provider_name}
              </button>
            ))}
          </div>
        </div>
      ) : null}
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
      <div className="toolbar">
        <button className="btn gold" type="submit">
          Run search
        </button>
        <button className="btn ghost" type="button" onClick={() => setFilters(defaultFilters())}>
          Reset
        </button>
      </div>
    </form>
  )
}

function num(value: string): number | null {
  if (value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}
