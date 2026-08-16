import { BrowserWindow, dialog, ipcMain } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import type {
  DiscoverFilters,
  ForYouResult,
  Genre,
  ImportProgress,
  LibraryEntry,
  MovieDetails,
  MovieSummary,
  PagedMovies,
  RankedMovie,
  Settings,
  WatchProvider,
  WatchStatus
} from '../shared/types'
import { parseImdbRatingsCsv } from './csv'
import { buildProfile, describeProfile, pickSeeds, publicProfile, scoreMovie } from './ranking'
import type { AppStore } from './store'
import { TmdbClient, TmdbError } from './tmdb'

let store: AppStore
let getWindow: () => BrowserWindow | null
let genreCache: Genre[] = []

export function registerIpc(appStore: AppStore, windowGetter: () => BrowserWindow | null): void {
  store = appStore
  getWindow = windowGetter

  ipcMain.handle('settings:get', () => store.getSettings())
  ipcMain.handle('settings:set', (_e, patch: Partial<Settings>) => {
    genreCache = []
    return store.setSettings(patch)
  })
  ipcMain.handle('tmdb:configured', () => client().configured())
  ipcMain.handle('tmdb:genres', () => loadGenres())
  ipcMain.handle('tmdb:providers', () => loadProviders())
  ipcMain.handle('tmdb:searchPeople', (_e, query: string) => client().searchPeople(query))
  ipcMain.handle('tmdb:searchKeywords', (_e, query: string) => client().searchKeywords(query))
  ipcMain.handle('tmdb:discover', (_e, filters: DiscoverFilters) => discover(filters))
  ipcMain.handle('tmdb:movie', (_e, id: number) => client().movie(id))
  ipcMain.handle('library:list', () => store.listLibrary())
  ipcMain.handle('library:upsert', (_e, payload: LibraryUpsert) => upsertLibrary(payload))
  ipcMain.handle('library:remove', (_e, tmdbId: number) => {
    store.removeEntry(tmdbId)
    return store.listLibrary()
  })
  ipcMain.handle('library:clear', () => {
    store.clearLibrary()
    return store.listLibrary()
  })
  ipcMain.handle('library:export', () => exportLibrary())
  ipcMain.handle('library:importImdbCsv', () => importImdbCsv())
  ipcMain.handle('ranking:forYou', () => forYou())
  ipcMain.handle('ranking:profile', async () => {
    const genres = await loadGenres().catch(() => [] as Genre[])
    return publicProfile(buildProfile(store.listLibrary(), genres))
  })
}

interface LibraryUpsert {
  movie: MovieSummary | MovieDetails
  status: WatchStatus
  rating?: number
}

function client(): TmdbClient {
  return new TmdbClient(store.getSettings().tmdbApiKey || process.env.TMDB_API_KEY || '')
}

async function loadGenres(): Promise<Genre[]> {
  if (genreCache.length) return genreCache
  const data = await client().genres()
  genreCache = data.genres
  return genreCache
}

async function loadProviders(): Promise<WatchProvider[]> {
  const region = store.getSettings().region || 'US'
  const data = await client().providers(region)
  return (data.results ?? [])
    .sort((a, b) => a.provider_name.localeCompare(b.provider_name))
    .slice(0, 40)
}

async function discover(filters: DiscoverFilters): Promise<PagedMovies> {
  const tmdb = client()
  const library = new Map(store.listLibrary().map((e) => [e.tmdbId, e]))
  const genres = await loadGenres().catch(() => [] as Genre[])
  const profile = buildProfile(store.listLibrary(), genres)
  const mode = store.getSettings().rankingMode
  const query = filters.query.trim()

  let page = { page: filters.page, totalPages: 1, totalResults: 0, results: [] as MovieSummary[] }

  if (/^tt\d{5,}$/i.test(query)) {
    const found = await tmdb.findByImdb(query)
    page = {
      page: 1,
      totalPages: found ? 1 : 0,
      totalResults: found ? 1 : 0,
      results: found ? [found] : []
    }
  } else if (query) {
    page = await tmdb.searchMovies(query, filters.page)
    page.results = page.results.filter((movie) => matchesLocalFilters(movie, filters))
  } else {
    const extra = filters.sortBy === 'match' && filters.page === 1 ? 3 : 0
    const pages = await Promise.all(
      Array.from({ length: 1 + extra }, (_, i) => tmdb.discover(filters, filters.page + i))
    )
    const seen = new Set<number>()
    const results: MovieSummary[] = []
    for (const p of pages) {
      for (const movie of p.results) {
        if (seen.has(movie.tmdbId)) continue
        seen.add(movie.tmdbId)
        results.push(movie)
      }
    }
    page = {
      page: filters.page,
      totalPages: pages[0]?.totalPages ?? 1,
      totalResults: pages[0]?.totalResults ?? results.length,
      results
    }
  }

  let results = page.results
  if (filters.hideWatched) {
    results = results.filter((m) => library.get(m.tmdbId)?.status !== 'watched')
  }
  if (filters.hideWatchlist) {
    results = results.filter((m) => library.get(m.tmdbId)?.status !== 'watchlist')
  }
  results = results.filter((m) => library.get(m.tmdbId)?.status !== 'skipped')

  for (const entry of library.values()) {
    tmdb.rememberRuntime(entry.tmdbId, entry.runtime)
  }
  await tmdb.prefetchRuntimes(results.map((movie) => movie.tmdbId))
  results = results.map((movie) => ({
    ...movie,
    runtime: movie.runtime ?? tmdb.runtimeOf(movie.tmdbId)
  }))

  let ranked: RankedMovie[] = results.map((movie) => scoreMovie(movie, profile, mode, library))
  if (filters.sortBy === 'match') {
    ranked.sort((a, b) => b.match - a.match)
  }

  return {
    page: page.page,
    totalPages: page.totalPages,
    totalResults: page.totalResults,
    results: ranked
  }
}

function matchesLocalFilters(movie: MovieSummary, filters: DiscoverFilters): boolean {
  if (filters.genres.length && !filters.genres.some((id) => movie.genreIds.includes(id))) return false
  if (filters.withoutGenres.some((id) => movie.genreIds.includes(id))) return false
  if (filters.yearMin && (movie.year ?? 0) < filters.yearMin) return false
  if (filters.yearMax && (movie.year ?? 9999) > filters.yearMax) return false
  if (movie.voteAverage < filters.ratingMin || movie.voteAverage > filters.ratingMax) return false
  if (movie.voteCount < filters.voteCountMin) return false
  if (filters.language && movie.originalLanguage !== filters.language) return false
  return true
}

async function upsertLibrary(payload: LibraryUpsert): Promise<LibraryEntry[]> {
  const now = new Date().toISOString()
  const existing = store.getEntry(payload.movie.tmdbId)
  let details: MovieDetails | null = null
  const needsCredits = !(payload.movie as MovieDetails).directors && !payload.movie.directorIds?.length
  try {
    if (needsCredits || !payload.movie.imdbId) {
      details = await client().movie(payload.movie.tmdbId)
    }
  } catch {
    details = null
  }

  const movie = details ?? payload.movie
  const directors = details?.directors ?? []
  const cast = details?.cast ?? []
  const entry: LibraryEntry = {
    tmdbId: movie.tmdbId,
    imdbId: movie.imdbId ?? existing?.imdbId,
    title: movie.title,
    overview: movie.overview,
    posterPath: movie.posterPath,
    backdropPath: movie.backdropPath,
    releaseDate: movie.releaseDate,
    year: movie.year,
    genreIds: movie.genreIds,
    runtime: details?.runtime ?? movie.runtime ?? existing?.runtime,
    originalLanguage: movie.originalLanguage,
    voteAverage: movie.voteAverage,
    voteCount: movie.voteCount,
    directorIds: details?.directorIds ?? movie.directorIds ?? existing?.directorIds ?? directors.map((d) => d.id),
    directorNames: details?.directorNames ?? movie.directorNames ?? existing?.directorNames ?? directors.map((d) => d.name),
    castIds: details?.castIds ?? movie.castIds ?? existing?.castIds ?? cast.slice(0, 8).map((c) => c.id),
    castNames: details?.castNames ?? movie.castNames ?? existing?.castNames ?? cast.slice(0, 8).map((c) => c.name),
    status: payload.status,
    rating: payload.rating ?? existing?.rating,
    ratedAt: payload.rating != null ? now : existing?.ratedAt,
    watchedAt: payload.status === 'watched' ? existing?.watchedAt ?? now : existing?.watchedAt,
    updatedAt: now
  }
  store.upsertEntry(entry)
  return store.listLibrary()
}

async function forYou(): Promise<ForYouResult> {
  const libraryList = store.listLibrary()
  const library = new Map(libraryList.map((e) => [e.tmdbId, e]))
  const genres = await loadGenres().catch(() => [] as Genre[])
  const profile = buildProfile(libraryList, genres)
  const insights = describeProfile(profile)
  const mode = store.getSettings().rankingMode
  const tmdb = client()

  const candidates = new Map<number, MovieSummary>()
  const seeds = pickSeeds(libraryList)

  const tasks: Promise<MovieSummary[]>[] = seeds.slice(0, 6).flatMap((seed) => [
    tmdb.recommendations(seed.tmdbId).catch(() => [] as MovieSummary[]),
    tmdb.similar(seed.tmdbId).catch(() => [] as MovieSummary[])
  ])

  const topGenreIds = [...profile.genres.entries()]
    .sort((a, b) => b[1].weight - a[1].weight)
    .slice(0, 3)
    .map(([id]) => id)

  const year = new Date().getFullYear()
  const baseFilters: DiscoverFilters = {
    query: '',
    genres: topGenreIds.slice(0, 2),
    withoutGenres: [],
    yearMin: 1970,
    yearMax: year,
    ratingMin: 6.4,
    ratingMax: 10,
    voteCountMin: 250,
    runtimeMin: null,
    runtimeMax: null,
    language: '',
    cast: [],
    directors: [],
    keywords: [],
    providers: [],
    sortBy: 'popularity.desc',
    hideWatched: true,
    hideWatchlist: false,
    page: 1
  }

  tasks.push(tmdb.discover(baseFilters, 1).then((p) => p.results).catch(() => [] as MovieSummary[]))
  if (topGenreIds[0]) {
    tasks.push(
      tmdb
        .discover({ ...baseFilters, genres: [topGenreIds[0]], yearMin: year - 8 }, 1)
        .then((p) => p.results)
        .catch(() => [] as MovieSummary[])
    )
  }
  if (mode === 'diverse' && topGenreIds.length > 2) {
    tasks.push(
      tmdb
        .discover({ ...baseFilters, genres: [topGenreIds[2]] }, 1)
        .then((p) => p.results)
        .catch(() => [] as MovieSummary[])
    )
  }

  const batches = await Promise.all(tasks)
  for (const batch of batches) {
    for (const movie of batch) {
      const status = library.get(movie.tmdbId)?.status
      if (status === 'watched' || status === 'skipped') continue
      if (!candidates.has(movie.tmdbId)) candidates.set(movie.tmdbId, movie)
    }
  }

  const ranked = [...candidates.values()]
    .map((movie) => scoreMovie(movie, profile, mode, library))
    .sort((a, b) => b.match - a.match)
    .slice(0, 40)

  return { profile: publicProfile(profile), insights, movies: ranked }
}

async function exportLibrary(): Promise<{ ok: boolean; path?: string }> {
  const win = getWindow()
  const saveOpts = {
    title: 'Export IMDBrain library',
    defaultPath: 'imdbrain-library.json',
    filters: [{ name: 'JSON', extensions: ['json'] }]
  }
  const result = win
    ? await dialog.showSaveDialog(win, saveOpts)
    : await dialog.showSaveDialog(saveOpts)
  if (result.canceled || !result.filePath) return { ok: false }
  writeFileSync(result.filePath, store.exportLibrary(), 'utf8')
  return { ok: true, path: result.filePath }
}

async function importImdbCsv(): Promise<ImportProgress> {
  const win = getWindow()
  const openOpts = {
    title: 'Import IMDb ratings.csv',
    filters: [{ name: 'CSV', extensions: ['csv'] }],
    properties: ['openFile'] as Array<'openFile'>
  }
  const picked = win ? await dialog.showOpenDialog(win, openOpts) : await dialog.showOpenDialog(openOpts)
  const empty: ImportProgress = { current: 0, total: 0, title: '', imported: 0, skipped: 0, errors: 0, done: true }
  if (picked.canceled || !picked.filePaths[0]) return empty

  const rows = parseImdbRatingsCsv(readFileSync(picked.filePaths[0], 'utf8'))
  const progress: ImportProgress = {
    current: 0,
    total: rows.length,
    title: '',
    imported: 0,
    skipped: 0,
    errors: 0,
    done: false
  }
  emitProgress(progress)

  const tmdb = client()
  for (const [index, row] of rows.entries()) {
    progress.current = index + 1
    progress.title = row.title
    emitProgress(progress)
    try {
      const summary = await tmdb.findByImdb(row.imdbId)
      if (!summary) {
        progress.skipped++
        continue
      }
      await upsertLibrary({
        movie: { ...summary, imdbId: row.imdbId },
        status: 'watched',
        rating: row.rating
      })
      const entry = store.getEntry(summary.tmdbId)
      if (entry && row.dateRated) {
        store.upsertEntry({ ...entry, ratedAt: row.dateRated, watchedAt: row.dateRated })
      }
      progress.imported++
    } catch (error) {
      if (error instanceof TmdbError && error.status === 401) throw error
      progress.errors++
    }
  }

  progress.done = true
  progress.title = 'Import complete'
  emitProgress(progress)
  return progress
}

function emitProgress(progress: ImportProgress): void {
  getWindow()?.webContents.send('library:importProgress', { ...progress })
}
