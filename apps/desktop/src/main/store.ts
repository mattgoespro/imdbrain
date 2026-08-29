import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { defaultSettings, titleKey, type LibraryEntry, type MediaType, type Settings } from '../shared/types'

interface PersistedState {
  settings: Settings
  library: Record<string, LibraryEntry>
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
      const library: Record<string, LibraryEntry> = {}
      for (const entry of Object.values(raw.library ?? {})) {
        if (!entry?.tmdbId) continue
        const normalized = normalizeEntry(entry)
        library[titleKey(normalized)] = normalized
      }
      return {
        settings: { ...defaultSettings(), ...(raw.settings ?? {}) },
        library
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

  getEntry(tmdbId: number, mediaType: MediaType = 'movie'): LibraryEntry | undefined {
    return this.state.library[titleKey({ tmdbId, mediaType })]
  }

  upsertEntry(entry: LibraryEntry): LibraryEntry {
    const normalized = normalizeEntry(entry)
    this.state.library[titleKey(normalized)] = normalized
    this.save()
    return normalized
  }

  removeEntry(tmdbId: number, mediaType: MediaType = 'movie'): void {
    delete this.state.library[titleKey({ tmdbId, mediaType })]
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

function normalizeEntry(entry: LibraryEntry): LibraryEntry {
  const mediaType = entry.mediaType ?? 'movie'
  return {
    ...entry,
    mediaType,
    titleKind: entry.titleKind ?? (mediaType === 'tv' ? 'tv' : 'movie')
  }
}
