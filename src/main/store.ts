import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { defaultSettings, type LibraryEntry, type Settings } from '../shared/types'

interface PersistedState {
  settings: Settings
  library: Record<number, LibraryEntry>
}

function emptyState(): PersistedState {
  return { settings: defaultSettings(), library: {} }
}

export class AppStore {
  private path: string
  private state: PersistedState

  constructor() {
    const dir = app.getPath('userData')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    this.path = join(dir, 'imdbrain.json')
    this.state = this.load()
  }

  private load(): PersistedState {
    try {
      if (!existsSync(this.path)) return emptyState()
      const raw = JSON.parse(readFileSync(this.path, 'utf8')) as Partial<PersistedState>
      return {
        settings: { ...defaultSettings(), ...(raw.settings ?? {}) },
        library: raw.library ?? {}
      }
    } catch {
      return emptyState()
    }
  }

  private save(): void {
    writeFileSync(this.path, JSON.stringify(this.state, null, 2), 'utf8')
  }

  getSettings(): Settings {
    return { ...this.state.settings }
  }

  setSettings(patch: Partial<Settings>): Settings {
    this.state.settings = { ...this.state.settings, ...patch }
    this.save()
    return this.getSettings()
  }

  listLibrary(): LibraryEntry[] {
    return Object.values(this.state.library).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  getEntry(tmdbId: number): LibraryEntry | undefined {
    return this.state.library[tmdbId]
  }

  upsertEntry(entry: LibraryEntry): LibraryEntry {
    this.state.library[entry.tmdbId] = entry
    this.save()
    return entry
  }

  removeEntry(tmdbId: number): void {
    delete this.state.library[tmdbId]
    this.save()
  }

  clearLibrary(): void {
    this.state.library = {}
    this.save()
  }

  exportLibrary(): string {
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        library: this.listLibrary()
      },
      null,
      2
    )
  }
}
