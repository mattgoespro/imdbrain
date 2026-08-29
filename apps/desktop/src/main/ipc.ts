import { BrowserWindow, dialog, ipcMain } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import {
  mediaTypeOf,
  sortMovies,
  titleKey,
  type DiscoverFilters,
  type ForYouResult,
  type Genre,
  type ImportProgress,
  type LibraryEntry,
  type MediaType,
  type MovieDetails,
  type MovieEnrichment,
  type MovieSummary,
  type PagedMovies,
  type Settings,
  type WatchProvider,
  type WatchStatus
} from '../shared/types'
import { parseImdbRatingsCsv, preferredMediaType } from './csv'
import { ImdbRatingsClient, ratingsApiUrl } from './imdb-ratings'
import { buildProfile, describeProfile, pickSeeds, publicProfile, scoreMovie } from './ranking'
import type { AppStore } from './store'
import { TmdbClient, TmdbError } from './tmdb'

let store: AppStore
let getWindow: () => BrowserWindow | null
let genreCache: Partial<Record<MediaType, Genre[]>> = {}

export function registerIpc(appStore: AppStore, windowGetter: () => BrowserWindow | null): void {
  store = appStore
  getWindow = windowGetter

  ipcMain.handle('settings:get', () => store.getSettings())
  ipcMain.handle('settings:set', (_e, patch: Partial<Settings>) => {
    genreCache = {}
    return store.setSettings(patch)
  })
  ipcMain.handle('tmdb:configured', () => client().configured())
  ipcMain.handle('tmdb:genres', (_e, mediaType?: MediaType) => loadGenres(mediaType ?? 'movie'))
  ipcMain.handle('tmdb:providers', () => loadProviders())
  ipcMain.handle('tmdb:searchPeople', (_e, query: string) => client().searchPeople(query))
  ipcMain.handle('tmdb:searchKeywords', (_e, query: string) => client().searchKeywords(query))
  ipcMain.handle('tmdb:discover', (_e, filters: DiscoverFilters) => discover(filters))
  ipcMain.handle('tmdb:movie', (_e, id: number, mediaType?: MediaType) =>
    client().title(id, mediaType ?? 'movie')
  )
  ipcMain.handle('tmdb:movieMeta', (_e, movies: MovieSummary[]) => enrichMovies(movies))
  ipcMain.handle('library:list', () => store.listLibrary())
  ipcMain.handle('library:upsert', (_e, payload: LibraryUpsert) => upsertLibrary(payload))
  ipcMain.handle('library:remove', (_e, tmdbId: number, mediaType?: MediaType) => {
    store.removeEntry(tmdbId, mediaType ?? 'movie')
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
    const genres = await loadMergedGenres()
    return publicProfile(buildProfile(store.listLibrary(), genres))
  })
}

interface LibraryUpsert {
  movie: MovieSummary | MovieDetails
  status: WatchStatus
  rating?: number
}

function client(): TmdbClient {
  const settings = store.getSettings()
  return new TmdbClient(settings.tmdbApiKey || process.env.TMDB_API_KEY || '', settings.region || 'US')
}

async function loadGenres(mediaType: MediaType = 'movie'): Promise<Genre[]> {
  const cached = genreCache[mediaType]
  if (cached?.length) return cached
  const data = await client().genres(mediaType)
  genreCache[mediaType] = data.genres
  return data.genres
}

async function loadMergedGenres(): Promise<Genre[]> {
  const [movies, shows] = await Promise.all([
    loadGenres('movie').catch(() => [] as Genre[]),
    loadGenres('tv').catch(() => [] as Genre[])
  ])
  const merged = new Map<number, Genre>()
  for (const genre of [...movies, ...shows]) merged.set(genre.id, genre)
  return [...merged.values()]
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
  const library = libraryMap(store.listLibrary())
  const genres = await loadMergedGenres()
  const profile = buildProfile(store.listLibrary(), genres)
  const mode = store.getSettings().rankingMode
  const query = filters.query.trim()
  const mediaType = mediaTypeOf(filters.titleKind)

  let page = { page: filters.page, totalPages: 1, totalResults: 0, results: [] as MovieSummary[] }

  if (/^tt\d{5,}$/i.test(query)) {
    const found = await tmdb.findByImdb(query, mediaType)
    page = {
      page: 1,
      totalPages: found ? 1 : 0,
      totalResults: found ? 1 : 0,
      results: found ? [found] : []
    }
  } else if (query) {
    page =
      mediaType === 'tv'
        ? await tmdb.searchTv(query, filters.page, filters.titleKind)
        : await tmdb.searchMovies(query, filters.page)
    page.results = page.results.filter((movie) => matchesLocalFilters(movie, filters, false))
  } else {
    const extra = filters.sortBy === 'match' && filters.page === 1 ? 3 : 0
    const startPage = Math.max(1, filters.page)
    const pages = await Promise.all(
      Array.from({ length: 1 + extra }, (_, i) => tmdb.discover(filters, startPage + i))
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
      page: startPage + extra,
      totalPages: pages[0]?.totalPages ?? 1,
      totalResults: pages[0]?.totalResults ?? results.length,
      results
    }
  }

  let results = page.results
  if (filters.hideWatched) {
    results = results.filter((m) => library.get(titleKey(m))?.status !== 'watched')
  }
  if (filters.hideWatchlist) {
    results = results.filter((m) => library.get(titleKey(m))?.status !== 'watchlist')
  }
  results = results.filter((m) => library.get(titleKey(m))?.status !== 'skipped')

  seedLibraryMeta(tmdb, library)
  results = results.map((movie) => tmdb.hydrateMovie(movie, library.get(titleKey(movie))))
  results = await applyImdbRatings(tmdb, results)
  results = results.filter((movie) => matchesRatingFilters(movie, filters))
  void tmdb.prefetchMovieMeta(results)

  const ranked = sortMovies(
    results.map((movie) => scoreMovie(movie, profile, mode, library)),
    filters.sortBy
  )
  if (ranked[0]) void tmdb.title(ranked[0].tmdbId, ranked[0].mediaType).catch(() => undefined)

  return {
    page: page.page,
    totalPages: page.totalPages,
    totalResults: page.totalResults,
    results: ranked
  }
}

function matchesLocalFilters(movie: MovieSummary, filters: DiscoverFilters, includeRatings = true): boolean {
  if (filters.genres.length && !filters.genres.some((id) => movie.genreIds.includes(id))) return false
  if (filters.withoutGenres.some((id) => movie.genreIds.includes(id))) return false
  if (filters.yearMin && (movie.year ?? 0) < filters.yearMin) return false
  if (filters.yearMax && (movie.year ?? 9999) > filters.yearMax) return false
  if (filters.language && movie.originalLanguage !== filters.language) return false
  if (includeRatings && !matchesRatingFilters(movie, filters)) return false
  return true
}

function matchesRatingFilters(movie: MovieSummary, filters: DiscoverFilters): boolean {
  if (movie.voteAverage < filters.ratingMin || movie.voteAverage > filters.ratingMax) return false
  if (movie.voteCount < filters.voteCountMin) return false
  return true
}

async function upsertLibrary(payload: LibraryUpsert): Promise<LibraryEntry[]> {
  const now = new Date().toISOString()
  const mediaType = payload.movie.mediaType ?? 'movie'
  const existing = store.getEntry(payload.movie.tmdbId, mediaType)
  let details: MovieDetails | null = null
  const needsCredits = !(payload.movie as MovieDetails).directors && !payload.movie.directorIds?.length
  try {
    if (needsCredits || !payload.movie.imdbId) {
      details = await client().title(payload.movie.tmdbId, mediaType)
    }
  } catch {
    details = null
  }

  const movie = details ?? payload.movie
  const directors = details?.directors ?? []
  const cast = details?.cast ?? []
  const entry: LibraryEntry = {
    tmdbId: movie.tmdbId,
    mediaType: movie.mediaType ?? mediaType,
    titleKind: movie.titleKind ?? existing?.titleKind ?? (mediaType === 'tv' ? 'tv' : 'movie'),
    imdbId: movie.imdbId ?? existing?.imdbId,
    title: movie.title,
    overview: movie.overview,
    posterPath: movie.posterPath,
    backdropPath: movie.backdropPath,
    releaseDate: movie.releaseDate,
    year: movie.year,
    genreIds: movie.genreIds,
    runtime: details?.runtime ?? movie.runtime ?? existing?.runtime,
    certification: details?.certification ?? movie.certification ?? existing?.certification,
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
  const library = libraryMap(libraryList)
  const genres = await loadMergedGenres()
  const profile = buildProfile(libraryList, genres)
  const insights = describeProfile(profile)
  const mode = store.getSettings().rankingMode
  const tmdb = client()
  const movieGenreIds = new Set((await loadGenres('movie').catch(() => [] as Genre[])).map((genre) => genre.id))

  const candidates = new Map<string, MovieSummary>()
  const seeds = pickSeeds(libraryList)

  const tasks: Promise<MovieSummary[]>[] = seeds.slice(0, 6).flatMap((seed) => [
    tmdb.recommendations(seed.tmdbId, 1, seed.mediaType ?? 'movie').catch(() => [] as MovieSummary[]),
    tmdb.similar(seed.tmdbId, 1, seed.mediaType ?? 'movie').catch(() => [] as MovieSummary[])
  ])

  const topGenreIds = [...profile.genres.entries()]
    .sort((a, b) => b[1].weight - a[1].weight)
    .map(([id]) => id)
    .filter((id) => movieGenreIds.has(id))
    .slice(0, 3)

  const year = new Date().getFullYear()
  const baseFilters: DiscoverFilters = {
    query: '',
    titleKind: 'movie',
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
      const status = library.get(titleKey(movie))?.status
      if (status === 'watched' || status === 'skipped') continue
      if (!candidates.has(titleKey(movie))) candidates.set(titleKey(movie), movie)
    }
  }

  seedLibraryMeta(tmdb, library)

  const patched = await applyImdbRatings(
    tmdb,
    [...candidates.values()].map((movie) => tmdb.hydrateMovie(movie, library.get(titleKey(movie))))
  )
  const ranked = patched
    .map((movie) => scoreMovie(movie, profile, mode, library))
    .sort((a, b) => b.match - a.match)
    .slice(0, 40)

  void tmdb.prefetchMovieMeta(ranked)

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
      const summary = await tmdb.findByImdb(row.imdbId, preferredMediaType(row.titleType))
      if (!summary) {
        progress.skipped++
        continue
      }
      await upsertLibrary({
        movie: { ...summary, imdbId: row.imdbId },
        status: 'watched',
        rating: row.rating
      })
      const entry = store.getEntry(summary.tmdbId, summary.mediaType)
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

function libraryMap(entries: LibraryEntry[]): Map<string, LibraryEntry> {
  return new Map(entries.map((entry) => [titleKey(entry), entry]))
}

function seedLibraryMeta(tmdb: TmdbClient, library: Map<string, LibraryEntry>): void {
  for (const entry of library.values()) {
    const mediaType = entry.mediaType ?? 'movie'
    tmdb.rememberRuntime(entry.tmdbId, entry.runtime, mediaType)
    tmdb.rememberCertification(entry.tmdbId, entry.certification, mediaType)
    tmdb.rememberImdbId(entry.tmdbId, entry.imdbId, mediaType)
    if (entry.directorIds.length || entry.castIds.length) {
      tmdb.rememberCredits(
        entry.tmdbId,
        {
          directorIds: entry.directorIds,
          directorNames: entry.directorNames,
          castIds: entry.castIds,
          castNames: entry.castNames
        },
        mediaType
      )
    }
  }
}

async function applyImdbRatings(tmdb: TmdbClient, movies: MovieSummary[]): Promise<MovieSummary[]> {
  const withIds = await tmdb.resolveImdbIds(movies)
  const ids = withIds.map((movie) => movie.imdbId).filter((id): id is string => Boolean(id))
  const ratings = await new ImdbRatingsClient(ratingsApiUrl(store.getSettings().imdbApiUrl)).lookup(ids)
  if (!ratings.size) return withIds
  return withIds.map((movie) => {
    const row = movie.imdbId ? ratings.get(movie.imdbId.toLowerCase()) : undefined
    if (!row) return movie
    return { ...movie, voteAverage: row.rating, voteCount: row.votes }
  })
}

async function enrichMovies(movies: MovieSummary[]): Promise<Record<string, MovieEnrichment>> {
  if (!movies.length) return {}
  const tmdb = client()
  const library = libraryMap(store.listLibrary())
  seedLibraryMeta(tmdb, library)
  await tmdb.prefetchMovieMeta(movies)
  const genres = await loadMergedGenres()
  const profile = buildProfile(store.listLibrary(), genres)
  const mode = store.getSettings().rankingMode
  const patches: Record<string, MovieEnrichment> = {}
  for (const movie of movies) {
    const ranked = scoreMovie(tmdb.hydrateMovie(movie, library.get(titleKey(movie))), profile, mode, library)
    patches[titleKey(movie)] = {
      runtime: ranked.runtime,
      certification: ranked.certification,
      directorIds: ranked.directorIds,
      directorNames: ranked.directorNames,
      castIds: ranked.castIds,
      castNames: ranked.castNames,
      seasonCount: ranked.seasonCount,
      episodeCount: ranked.episodeCount,
      match: ranked.match,
      reasons: ranked.reasons
    }
  }
  return patches
}
