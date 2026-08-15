import { contextBridge, ipcRenderer } from 'electron'
import type {
  DiscoverFilters,
  ForYouResult,
  Genre,
  ImportProgress,
  LibraryEntry,
  MovieDetails,
  PagedMovies,
  Settings,
  TasteProfile,
  WatchProvider,
  WatchStatus,
  KeywordRef,
  PersonRef,
  MovieSummary
} from '../shared/types'

const api = {
  getSettings: (): Promise<Settings> => ipcRenderer.invoke('settings:get'),
  setSettings: (patch: Partial<Settings>): Promise<Settings> => ipcRenderer.invoke('settings:set', patch),
  configured: (): Promise<boolean> => ipcRenderer.invoke('tmdb:configured'),
  genres: (): Promise<Genre[]> => ipcRenderer.invoke('tmdb:genres'),
  providers: (): Promise<WatchProvider[]> => ipcRenderer.invoke('tmdb:providers'),
  searchPeople: (query: string): Promise<PersonRef[]> => ipcRenderer.invoke('tmdb:searchPeople', query),
  searchKeywords: (query: string): Promise<KeywordRef[]> => ipcRenderer.invoke('tmdb:searchKeywords', query),
  discover: (filters: DiscoverFilters): Promise<PagedMovies> => ipcRenderer.invoke('tmdb:discover', filters),
  movie: (id: number): Promise<MovieDetails> => ipcRenderer.invoke('tmdb:movie', id),
  listLibrary: (): Promise<LibraryEntry[]> => ipcRenderer.invoke('library:list'),
  upsertLibrary: (payload: {
    movie: MovieSummary | MovieDetails
    status: WatchStatus
    rating?: number
  }): Promise<LibraryEntry[]> => ipcRenderer.invoke('library:upsert', payload),
  removeLibrary: (tmdbId: number): Promise<LibraryEntry[]> => ipcRenderer.invoke('library:remove', tmdbId),
  clearLibrary: (): Promise<LibraryEntry[]> => ipcRenderer.invoke('library:clear'),
  exportLibrary: (): Promise<{ ok: boolean; path?: string }> => ipcRenderer.invoke('library:export'),
  importImdbCsv: (): Promise<ImportProgress> => ipcRenderer.invoke('library:importImdbCsv'),
  forYou: (): Promise<ForYouResult> => ipcRenderer.invoke('ranking:forYou'),
  profile: (): Promise<TasteProfile> => ipcRenderer.invoke('ranking:profile'),
  onImportProgress: (handler: (progress: ImportProgress) => void): (() => void) => {
    const listener = (_event: unknown, progress: ImportProgress): void => handler(progress)
    ipcRenderer.on('library:importProgress', listener)
    return () => ipcRenderer.removeListener('library:importProgress', listener)
  }
}

export type ImdbrainAPI = typeof api

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore context isolation off
  window.api = api
}
