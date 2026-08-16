import { useCallback, useEffect, useMemo, useState, type JSX } from 'react'
import type {
  AppView,
  DiscoverFilters,
  Genre,
  LibraryEntry,
  MovieDetails,
  MovieSummary,
  Settings,
  TasteProfile
} from '../../shared/types'
import { defaultFilters, defaultSettings } from '../../shared/types'
import Discover from './views/Discover'
import ForYou from './views/ForYou'
import Library from './views/Library'
import SettingsView from './views/Settings'
import MovieModal from './components/MovieModal'

export default function App(): JSX.Element {
  const [view, setView] = useState<AppView>('discover')
  const [settings, setSettings] = useState<Settings>(defaultSettings())
  const [configured, setConfigured] = useState(false)
  const [genres, setGenres] = useState<Genre[]>([])
  const [library, setLibrary] = useState<LibraryEntry[]>([])
  const [profile, setProfile] = useState<TasteProfile | null>(null)
  const [filters, setFilters] = useState<DiscoverFilters>(defaultFilters())
  const [selected, setSelected] = useState<MovieSummary | null>(null)
  const [details, setDetails] = useState<MovieDetails | null>(null)
  const [error, setError] = useState('')
  const [booting, setBooting] = useState(true)

  const genreMap = useMemo(() => new Map(genres.map((g) => [g.id, g.name])), [genres])

  const refresh = useCallback(async () => {
    const [nextSettings, nextLibrary, isConfigured] = await Promise.all([
      window.api.getSettings(),
      window.api.listLibrary(),
      window.api.configured()
    ])
    setSettings(nextSettings)
    setLibrary(nextLibrary)
    setConfigured(isConfigured)
    if (isConfigured) {
      const [nextGenres, nextProfile] = await Promise.all([
        window.api.genres().catch(() => [] as Genre[]),
        window.api.profile().catch(() => null)
      ])
      setGenres(nextGenres)
      setProfile(nextProfile)
    }
  }, [])

  useEffect(() => {
    refresh()
      .catch((err: Error) => setError(err.message))
      .finally(() => setBooting(false))
  }, [refresh])

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setSelected(null)
      if (event.ctrlKey && event.key === '1') setView('discover')
      if (event.ctrlKey && event.key === '2') setView('foryou')
      if (event.ctrlKey && event.key === '3') setView('library')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!selected) {
      setDetails(null)
      return
    }
    let cancelled = false
    window.api
      .movie(selected.tmdbId)
      .then((movie) => {
        if (!cancelled) setDetails(movie)
      })
      .catch(() => {
        if (!cancelled) setDetails(null)
      })
    return () => {
      cancelled = true
    }
  }, [selected])

  async function saveSettings(patch: Partial<Settings>): Promise<void> {
    const next = await window.api.setSettings(patch)
    setSettings(next)
    setConfigured(Boolean(next.tmdbApiKey.trim()))
    setError('')
    await refresh()
  }

  async function upsert(movie: MovieSummary, status: LibraryEntry['status'], rating?: number): Promise<void> {
    const next = await window.api.upsertLibrary({ movie, status, rating })
    setLibrary(next)
    setProfile(await window.api.profile().catch(() => profile))
  }

  const counts = {
    watched: library.filter((e) => e.status === 'watched').length,
    watchlist: library.filter((e) => e.status === 'watchlist').length,
    rated: library.filter((e) => e.rating != null).length
  }

  return (
    <div className="app">
      <div className="titlebar">
        <span>●</span> Personal ranking studio
      </div>
      <div className="shell">
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-mark">IB</div>
            <div>
              <h1>IMDBrain</h1>
              <p>Taste, ranked</p>
            </div>
          </div>
          <nav className="nav">
            <NavBtn id="discover" view={view} setView={setView} label="Advanced search" />
            <NavBtn id="foryou" view={view} setView={setView} label="Ranked for you" />
            <NavBtn id="library" view={view} setView={setView} label="Watch patterns" />
            <NavBtn id="settings" view={view} setView={setView} label="Settings" />
          </nav>
          <div className="sidebar-stats">
            <h3>Library</h3>
            <div className="stat-row">
              Rated <b>{counts.rated}</b>
            </div>
            <div className="stat-row">
              Watched <b>{counts.watched}</b>
            </div>
            <div className="stat-row">
              Watchlist <b>{counts.watchlist}</b>
            </div>
          </div>
        </aside>
        <main className={view === 'discover' ? 'main main-fill' : 'main'}>
          {error ? <div className="error">{error}</div> : null}
          {booting ? (
            <div className="empty">Loading your ranking studio…</div>
          ) : !configured && view !== 'settings' ? (
            <section className="welcome">
              <h2>Start with a TMDB key.</h2>
              <p>
                IMDBrain searches the IMDb-linked movie catalog through TMDB, then ranks titles against
                your ratings, skips, and watch history. The official IMDb API is not publicly available,
                so this app uses TMDB metadata plus IMDb IDs, IMDb page links, and optional IMDb ratings
                import.
              </p>
              <p>
                Create a free key at{' '}
                <a className="link" href="https://www.themoviedb.org/settings/api" target="_blank" rel="noreferrer">
                  themoviedb.org/settings/api
                </a>
                , then paste it in Settings.
              </p>
              <button className="btn gold" onClick={() => setView('settings')}>
                Open Settings
              </button>
            </section>
          ) : view === 'discover' ? (
            <Discover
              filters={filters}
              setFilters={setFilters}
              genres={genres}
              onOpen={setSelected}
              onError={setError}
            />
          ) : view === 'foryou' ? (
            <ForYou
              profile={profile}
              genreMap={genreMap}
              onOpen={setSelected}
              onError={setError}
              rankingMode={settings.rankingMode}
            />
          ) : view === 'library' ? (
            <Library library={library} genreMap={genreMap} onOpen={setSelected} onChange={setLibrary} />
          ) : (
            <SettingsView settings={settings} onSave={saveSettings} onLibraryChange={setLibrary} onError={setError} />
          )}
        </main>
      </div>
      {selected ? (
        <MovieModal
          movie={selected}
          details={details}
          entry={library.find((e) => e.tmdbId === selected.tmdbId)}
          genreMap={genreMap}
          onClose={() => setSelected(null)}
          onUpsert={upsert}
          onRemove={async (id) => setLibrary(await window.api.removeLibrary(id))}
        />
      ) : null}
    </div>
  )
}

function NavBtn({
  id,
  view,
  setView,
  label
}: {
  id: AppView
  view: AppView
  setView: (view: AppView) => void
  label: string
}): JSX.Element {
  return (
    <button className={view === id ? 'active' : ''} onClick={() => setView(id)}>
      <span className="dot" />
      {label}
    </button>
  )
}
