import { useEffect, useState, type JSX } from 'react'
import type { ImportProgress, LibraryEntry, RankingMode, Settings } from '../../../shared/types'
import Select from '../components/Select'
import { btn } from '../lib/ui'

const RANKING_OPTIONS = [
  { value: 'balanced', label: 'Balanced — taste plus a little recent context' },
  { value: 'same', label: 'More of the same — lean into your current streak' },
  { value: 'diverse', label: 'Surprise me — downrank genres you just watched' }
] as const

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
      <div className="mb-[22px] flex items-end justify-between gap-4">
        <div>
          <h2 className="m-0 text-[28px] font-650 tracking-title">Settings</h2>
          <p className="mt-1.5 mb-0 max-w-[640px] text-[13px] leading-[1.45] text-muted">
            Connect the catalog, tune how watch streaks affect ranking, and import your IMDb history.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 items-stretch inspect:grid-cols-2 inspect:gap-0">
        <div className="min-w-0 border border-line p-[18px]">
          <h3 className="kicker">Catalog access</h3>
          <label className="mb-1 flex min-w-0 flex-col gap-1.5 text-xs font-medium text-muted">
            TMDB API key
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste key from themoviedb.org"
            />
          </label>
          <p className="text-xs leading-[1.45] text-muted tabular">
            Free at{' '}
            <a className="text-accent" href="https://www.themoviedb.org/settings/api" target="_blank" rel="noreferrer">
              themoviedb.org/settings/api
            </a>
            . IMDBrain stores it only on this PC.
          </p>
          <label className="mb-1 flex min-w-0 flex-col gap-1.5 text-xs font-medium text-muted">
            Region
            <input type="text" value={region} maxLength={2} onChange={(e) => setRegion(e.target.value.toUpperCase())} />
          </label>
          <label className="mb-1 flex min-w-0 flex-col gap-1.5 text-xs font-medium text-muted">
            Ranking mode
            <Select
              value={mode}
              ariaLabel="Ranking mode"
              options={RANKING_OPTIONS}
              onChange={(next) => setMode(next as RankingMode)}
            />
          </label>
          <button className={btn('primary')} onClick={() => void save()}>
            Save settings
          </button>
        </div>
        <div className="min-w-0 border border-line border-t-0 p-[18px] inspect:border-t inspect:border-l-0">
          <h3 className="kicker">IMDb ratings import</h3>
          <p className="text-xs leading-[1.45] text-muted tabular">
            On IMDb: Ratings → Export. Choose the CSV here. IMDBrain looks up each `tt` ID, stores the
            movie as watched, and rebuilds your taste model.
          </p>
          <div className="mb-3 flex flex-wrap gap-2">
            <button className={btn('primary')} disabled={busy} onClick={() => void importCsv()}>
              {busy ? 'Importing…' : 'Import ratings.csv'}
            </button>
            <button
              className={btn()}
              onClick={async () => {
                await window.api.exportLibrary()
              }}
            >
              Export library JSON
            </button>
            <button
              className={btn('danger')}
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
              <div className="my-2.5 h-2 overflow-hidden rounded-full bg-track">
                <div
                  className="h-full bg-accent"
                  style={{ width: progress.total ? `${(progress.current / progress.total) * 100}%` : '0%' }}
                />
              </div>
              <div className="text-xs leading-[1.45] text-muted tabular">
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
