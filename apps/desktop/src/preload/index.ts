import { contextBridge, ipcRenderer } from "electron";
import type {
  DiscoverFilters,
  ForYouResult,
  Genre,
  ImportProgress,
  LibraryEntry,
  MovieDetails,
  MovieEnrichment,
  MovieSummary,
  PagedMovies,
  Settings,
  TasteProfile,
  WatchProvider,
  WatchStatus,
  KeywordRef,
  MediaType,
  PersonRef,
} from "../shared/types";

const api = {
  getSettings: (): Promise<Settings> => ipcRenderer.invoke("settings:get"),
  setSettings: (patch: Partial<Settings>): Promise<Settings> =>
    ipcRenderer.invoke("settings:set", patch),
  configured: (): Promise<boolean> => ipcRenderer.invoke("tmdb:configured"),
  genres: (mediaType?: MediaType): Promise<Genre[]> =>
    ipcRenderer.invoke("tmdb:genres", mediaType),
  providers: (): Promise<WatchProvider[]> =>
    ipcRenderer.invoke("tmdb:providers"),
  searchPeople: (query: string): Promise<PersonRef[]> =>
    ipcRenderer.invoke("tmdb:searchPeople", query),
  searchKeywords: (query: string): Promise<KeywordRef[]> =>
    ipcRenderer.invoke("tmdb:searchKeywords", query),
  discover: (filters: DiscoverFilters): Promise<PagedMovies> =>
    ipcRenderer.invoke("tmdb:discover", filters),
  movie: (id: number, mediaType?: MediaType): Promise<MovieDetails> =>
    ipcRenderer.invoke("tmdb:movie", id, mediaType),
  movieMeta: (
    movies: MovieSummary[],
  ): Promise<Record<string, MovieEnrichment>> =>
    ipcRenderer.invoke("tmdb:movieMeta", movies),
  listLibrary: (): Promise<LibraryEntry[]> =>
    ipcRenderer.invoke("library:list"),
  upsertLibrary: (payload: {
    movie: MovieSummary | MovieDetails;
    status: WatchStatus;
    rating?: number;
  }): Promise<LibraryEntry[]> => ipcRenderer.invoke("library:upsert", payload),
  removeLibrary: (
    tmdbId: number,
    mediaType?: MediaType,
  ): Promise<LibraryEntry[]> =>
    ipcRenderer.invoke("library:remove", tmdbId, mediaType),
  clearLibrary: (): Promise<LibraryEntry[]> =>
    ipcRenderer.invoke("library:clear"),
  exportLibrary: (): Promise<{ ok: boolean; path?: string }> =>
    ipcRenderer.invoke("library:export"),
  importImdbCsv: (): Promise<ImportProgress> =>
    ipcRenderer.invoke("library:importImdbCsv"),
  forYou: (): Promise<ForYouResult> => ipcRenderer.invoke("ranking:forYou"),
  profile: (): Promise<TasteProfile> => ipcRenderer.invoke("ranking:profile"),
  onImportProgress: (
    handler: (progress: ImportProgress) => void,
  ): (() => void) => {
    const listener = (_event: unknown, progress: ImportProgress): void =>
      handler(progress);
    ipcRenderer.on("library:importProgress", listener);
    return () => ipcRenderer.removeListener("library:importProgress", listener);
  },
};

export type ImdbrainAPI = typeof api;

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore context isolation off
  window.api = api;
}
