import { useEffect, useState, type JSX } from 'react'
import type { ImportProgress, LibraryEntry, RankingMode, Settings } from '../../../shared/types'

export default function SettingsView({
  settings,
  onSave,
  onLibraryChange,
  onError
}: {
  settings: Settings
  onSave: (patch: Partial<Settings>) => Promise<void>
  onLibraryChange: (library: LibraryEntry[]) => void
  onError: (message: string) => void
}): JSX.Element {
  const [apiKey, setApiKey] = useState(settings.tmdbApiKey)
  const [region, setRegion] = useState(settings.region)
  const [mode, setMode] = useState<RankingMode>(settings.rankingMode)
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setApiKey(settings.tmdbApiKey)
    setRegion(settings.region)
    setMode(settings.rankingMode)
  }, [settings])

  useEffect(() => {
    return window.api.onImportProgress(setProgress)
  }, [])

  async function save(): Promise<void> {
    onError('')
    await onSave({ tmdbApiKey: apiKey.trim(), region, rankingMode: mode })
  }

  async function importCsv(): Promise<void> {
    setBusy(true)
    onError('')
    try {
      const result = await window.api.importImdbCsv()
      setProgress(result)
      onLibraryChange(await window.api.listLibrary())
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <h2>Settings</h2>
          <p>Connect the catalog, tune how watch streaks affect ranking, and import your IMDb history.</p>
        </div>
      </div>
      <div className="layout-split">
        <div className="panel">
          <h3>Catalog access</h3>
          <label className="field">
            TMDB API key
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste key from themoviedb.org"
            />
          </label>
          <p className="meta">
            Free at{' '}
            <a className="link" href="https://www.themoviedb.org/settings/api" target="_blank" rel="noreferrer">
              themoviedb.org/settings/api
            </a>
            . IMDBrain stores it only on this PC.
          </p>
          <label className="field">
            Region
            <input type="text" value={region} maxLength={2} onChange={(e) => setRegion(e.target.value.toUpperCase())} />
          </label>
          <label className="field">
            Ranking mode
            <select value={mode} onChange={(e) => setMode(e.target.value as RankingMode)}>
              <option value="balanced">Balanced — taste plus a little recent context</option>
              <option value="same">More of the same — lean into your current streak</option>
              <option value="diverse">Surprise me — downrank genres you just watched</option>
            </select>
          </label>
          <button className="btn gold" onClick={() => void save()}>
            Save settings
          </button>
        </div>
        <div className="panel">
          <h3>IMDb ratings import</h3>
          <p className="meta">
            On IMDb: Ratings → Export. Choose the CSV here. IMDBrain looks up each `tt` ID, stores the
            movie as watched, and rebuilds your taste model.
          </p>
          <div className="actions">
            <button className="btn gold" disabled={busy} onClick={() => void importCsv()}>
              {busy ? 'Importing…' : 'Import ratings.csv'}
            </button>
            <button
              className="btn"
              onClick={async () => {
                await window.api.exportLibrary()
              }}
            >
              Export library JSON
            </button>
            <button
              className="btn danger"
              onClick={async () => {
                if (confirm('Clear local ratings, watchlist, and skips?')) {
                  onLibraryChange(await window.api.clearLibrary())
                }
              }}
            >
              Clear library
            </button>
          </div>
          {progress ? (
            <div>
              <div className="progress">
                <div style={{ width: progress.total ? `${(progress.current / progress.total) * 100}%` : '0%' }} />
              </div>
              <div className="meta">
                {progress.current}/{progress.total} {progress.title} · imported {progress.imported} · skipped{' '}
                {progress.skipped} · errors {progress.errors}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
