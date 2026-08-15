export type WatchStatus = 'watched' | 'watchlist' | 'skipped'
export type RankingMode = 'balanced' | 'same' | 'diverse'
export type AppView = 'discover' | 'foryou' | 'library' | 'settings'

export interface Genre {
  id: number
  name: string
}

export interface PersonRef {
  id: number
  name: string
}

export interface KeywordRef {
  id: number
  name: string
}

export interface WatchProvider {
  provider_id: number
  provider_name: string
  logo_path: string | null
}

export interface MovieSummary {
  tmdbId: number
  imdbId?: string
  title: string
  originalTitle?: string
  overview: string
  posterPath: string | null
  backdropPath: string | null
  releaseDate: string
  year?: number
  genreIds: number[]
  originalLanguage: string
  popularity: number
  voteAverage: number
  voteCount: number
  adult: boolean
  runtime?: number
  directorIds?: number[]
  directorNames?: string[]
  castIds?: number[]
  castNames?: string[]
}

export interface CastMember {
  id: number
  name: string
  character: string
  order: number
  profilePath: string | null
}

export interface MovieDetails extends MovieSummary {
  imdbId?: string
  runtime?: number
  tagline?: string
  status?: string
  budget?: number
  revenue?: number
  homepage?: string
  genres: Genre[]
  directors: PersonRef[]
  cast: CastMember[]
  keywords: KeywordRef[]
}

export interface LibraryEntry {
  tmdbId: number
  imdbId?: string
  title: string
  overview?: string
  posterPath?: string | null
  backdropPath?: string | null
  releaseDate?: string
  year?: number
  genreIds: number[]
  runtime?: number
  originalLanguage?: string
  voteAverage: number
  voteCount: number
  directorIds: number[]
  directorNames: string[]
  castIds: number[]
  castNames: string[]
  status: WatchStatus
  rating?: number
  ratedAt?: string
  watchedAt?: string
  updatedAt: string
}

export interface DiscoverFilters {
  query: string
  genres: number[]
  withoutGenres: number[]
  yearMin: number | null
  yearMax: number | null
  ratingMin: number
  ratingMax: number
  voteCountMin: number
  runtimeMin: number | null
  runtimeMax: number | null
  language: string
  cast: PersonRef[]
  directors: PersonRef[]
  keywords: KeywordRef[]
  providers: number[]
  sortBy: string
  hideWatched: boolean
  hideWatchlist: boolean
  page: number
}

export interface PagedMovies {
  page: number
  totalPages: number
  totalResults: number
  results: RankedMovie[]
}

export interface RankReason {
  label: string
  detail: string
  weight: number
}

export interface RankedMovie extends MovieSummary {
  match: number
  reasons: RankReason[]
}

export interface Affinity {
  id: string
  name: string
  weight: number
  count: number
  avg: number
}

export interface TasteProfile {
  ratedCount: number
  watchedCount: number
  watchlistCount: number
  skippedCount: number
  globalAvg: number
  runtimeMean: number
  topGenres: Affinity[]
  topDecades: Affinity[]
  topDirectors: Affinity[]
  topCast: Affinity[]
  topLanguages: Affinity[]
  recentGenreIds: number[]
  ready: boolean
}

export interface Settings {
  tmdbApiKey: string
  region: string
  rankingMode: RankingMode
}

export interface ImportProgress {
  current: number
  total: number
  title: string
  imported: number
  skipped: number
  errors: number
  done: boolean
}

export interface ForYouResult {
  profile: TasteProfile
  insights: string[]
  movies: RankedMovie[]
}

export const LANGUAGES = [
  { code: '', label: 'Any language' },
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'French' },
  { code: 'es', label: 'Spanish' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'zh', label: 'Chinese' },
  { code: 'hi', label: 'Hindi' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'sv', label: 'Swedish' },
  { code: 'da', label: 'Danish' },
  { code: 'no', label: 'Norwegian' },
  { code: 'ru', label: 'Russian' },
  { code: 'pl', label: 'Polish' },
  { code: 'tr', label: 'Turkish' },
  { code: 'ar', label: 'Arabic' }
] as const

export const SORT_OPTIONS = [
  { value: 'match', label: 'Best match for you' },
  { value: 'popularity.desc', label: 'Popularity' },
  { value: 'vote_average.desc', label: 'IMDb-style rating' },
  { value: 'primary_release_date.desc', label: 'Newest first' },
  { value: 'primary_release_date.asc', label: 'Oldest first' },
  { value: 'revenue.desc', label: 'Box office' },
  { value: 'vote_count.desc', label: 'Most voted' }
] as const

export function defaultFilters(): DiscoverFilters {
  return {
    query: '',
    genres: [],
    withoutGenres: [],
    yearMin: 1970,
    yearMax: new Date().getFullYear(),
    ratingMin: 6,
    ratingMax: 10,
    voteCountMin: 200,
    runtimeMin: null,
    runtimeMax: null,
    language: '',
    cast: [],
    directors: [],
    keywords: [],
    providers: [],
    sortBy: 'match',
    hideWatched: true,
    hideWatchlist: false,
    page: 1
  }
}

export function defaultSettings(): Settings {
  return {
    tmdbApiKey: '',
    region: 'US',
    rankingMode: 'balanced'
  }
}

export function posterUrl(path: string | null | undefined, size = 'w342'): string | null {
  if (!path) return null
  return `https://image.tmdb.org/t/p/${size}${path}`
}

export function imdbUrl(imdbId?: string): string | null {
  if (!imdbId) return null
  return `https://www.imdb.com/title/${imdbId}/`
}

export function yearOf(date?: string): number | undefined {
  if (!date || date.length < 4) return undefined
  const year = Number(date.slice(0, 4))
  return Number.isFinite(year) ? year : undefined
}
