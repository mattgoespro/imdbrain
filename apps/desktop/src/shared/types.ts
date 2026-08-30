import {
  DEFAULT_ACCENT_COLOR,
  normalizeAccentColor,
  normalizeThemeMode,
  type ThemeMode,
} from "./appearance";

export type { ThemeMode } from "./appearance";
export type WatchStatus = "watched" | "watchlist" | "skipped";
export type RankingMode = "balanced" | "same" | "diverse";
export type AppView = "discover" | "foryou" | "library" | "settings";
export type MediaType = "movie" | "tv";
export type TitleKind = "movie" | "tv" | "miniseries";

export interface Genre {
  id: number;
  name: string;
}

export interface PersonRef {
  id: number;
  name: string;
}

export interface KeywordRef {
  id: number;
  name: string;
}

export interface WatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
}

export interface MovieSummary {
  tmdbId: number;
  mediaType: MediaType;
  titleKind: TitleKind;
  imdbId?: string;
  title: string;
  originalTitle?: string;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate: string;
  year?: number;
  genreIds: number[];
  originalLanguage: string;
  popularity: number;
  voteAverage: number;
  voteCount: number;
  adult: boolean;
  runtime?: number;
  certification?: string;
  directorIds?: number[];
  directorNames?: string[];
  castIds?: number[];
  castNames?: string[];
  seasonCount?: number;
  episodeCount?: number;
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  order: number;
  profilePath: string | null;
}

export interface MovieDetails extends MovieSummary {
  imdbId?: string;
  runtime?: number;
  tagline?: string;
  status?: string;
  budget?: number;
  revenue?: number;
  homepage?: string;
  genres: Genre[];
  directors: PersonRef[];
  cast: CastMember[];
  keywords: KeywordRef[];
}

export interface LibraryEntry {
  tmdbId: number;
  mediaType: MediaType;
  titleKind: TitleKind;
  imdbId?: string;
  title: string;
  overview?: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  releaseDate?: string;
  year?: number;
  genreIds: number[];
  runtime?: number;
  certification?: string;
  originalLanguage?: string;
  voteAverage: number;
  voteCount: number;
  directorIds: number[];
  directorNames: string[];
  castIds: number[];
  castNames: string[];
  status: WatchStatus;
  rating?: number;
  ratedAt?: string;
  watchedAt?: string;
  updatedAt: string;
}

export interface DiscoverFilters {
  query: string;
  titleKind: TitleKind;
  genres: number[];
  withoutGenres: number[];
  yearMin: number | null;
  yearMax: number | null;
  ratingMin: number;
  ratingMax: number;
  voteCountMin: number;
  runtimeMin: number | null;
  runtimeMax: number | null;
  language: string;
  cast: PersonRef[];
  directors: PersonRef[];
  keywords: KeywordRef[];
  providers: number[];
  sortBy: string;
  hideWatched: boolean;
  hideWatchlist: boolean;
  page: number;
}

export interface SearchHistoryGenre {
  id: number;
  name: string;
}

export interface SearchHistoryEntry {
  id: string;
  savedAt: string;
  titleKind: TitleKind;
  genres: SearchHistoryGenre[];
  yearMin: number | null;
  yearMax: number | null;
  ratingMin: number;
  sortBy: string;
}

export interface PagedMovies {
  page: number;
  totalPages: number;
  totalResults: number;
  results: RankedMovie[];
}

export interface RankReason {
  label: string;
  detail: string;
  weight: number;
}

export interface RankedMovie extends MovieSummary {
  match: number;
  reasons: RankReason[];
}

export interface MovieEnrichment {
  runtime?: number;
  certification?: string;
  directorIds?: number[];
  directorNames?: string[];
  castIds?: number[];
  castNames?: string[];
  seasonCount?: number;
  episodeCount?: number;
  imdbId?: string;
  voteAverage?: number;
  voteCount?: number;
  match?: number;
  reasons?: RankReason[];
}

export function applyMovieEnrichment(
  movie: RankedMovie,
  patch: MovieEnrichment,
): RankedMovie {
  return {
    ...movie,
    runtime: movie.runtime ?? patch.runtime,
    certification: movie.certification ?? patch.certification,
    directorIds: movie.directorIds?.length
      ? movie.directorIds
      : patch.directorIds,
    directorNames: movie.directorNames?.length
      ? movie.directorNames
      : patch.directorNames,
    castIds: movie.castIds?.length ? movie.castIds : patch.castIds,
    castNames: movie.castNames?.length ? movie.castNames : patch.castNames,
    seasonCount: movie.seasonCount ?? patch.seasonCount,
    episodeCount: movie.episodeCount ?? patch.episodeCount,
    imdbId: patch.imdbId ?? movie.imdbId,
    voteAverage: patch.voteAverage ?? movie.voteAverage,
    voteCount: patch.voteCount ?? movie.voteCount,
    match: patch.match ?? movie.match,
    reasons: patch.reasons ?? movie.reasons,
  };
}

export function matchesRatingFilters(
  movie: Pick<MovieSummary, "voteAverage" | "voteCount">,
  filters: Pick<DiscoverFilters, "ratingMin" | "ratingMax" | "voteCountMin">,
): boolean {
  if (
    movie.voteAverage < filters.ratingMin ||
    movie.voteAverage > filters.ratingMax
  )
    return false;
  if (movie.voteCount < filters.voteCountMin) return false;
  return true;
}

export interface Affinity {
  id: string;
  name: string;
  weight: number;
  count: number;
  avg: number;
}

export interface TasteProfile {
  ratedCount: number;
  watchedCount: number;
  watchlistCount: number;
  skippedCount: number;
  globalAvg: number;
  runtimeMean: number;
  topGenres: Affinity[];
  topDecades: Affinity[];
  topDirectors: Affinity[];
  topCast: Affinity[];
  topLanguages: Affinity[];
  recentGenreIds: number[];
  ready: boolean;
}

export interface Settings {
  tmdbApiKey: string;
  region: string;
  rankingMode: RankingMode;
  imdbApiUrl: string;
  themeMode: ThemeMode;
  accentColor: string;
}

export interface ImportProgress {
  current: number;
  total: number;
  title: string;
  imported: number;
  skipped: number;
  errors: number;
  done: boolean;
}

export interface ForYouResult {
  profile: TasteProfile;
  insights: string[];
  movies: RankedMovie[];
}

export const LANGUAGES = [
  { code: "", label: "Any language" },
  { code: "en", label: "English" },
  { code: "fr", label: "French" },
  { code: "es", label: "Spanish" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "zh", label: "Chinese" },
  { code: "hi", label: "Hindi" },
  { code: "pt", label: "Portuguese" },
  { code: "sv", label: "Swedish" },
  { code: "da", label: "Danish" },
  { code: "no", label: "Norwegian" },
  { code: "ru", label: "Russian" },
  { code: "pl", label: "Polish" },
  { code: "tr", label: "Turkish" },
  { code: "ar", label: "Arabic" },
] as const;

export const TITLE_KIND_OPTIONS = [
  { value: "movie", label: "Movies" },
  { value: "tv", label: "TV Series" },
  { value: "miniseries", label: "Mini-Series" },
] as const;

export const SORT_OPTIONS = [
  { value: "match", label: "Best match for you" },
  { value: "popularity.desc", label: "Popularity" },
  { value: "vote_average.desc", label: "IMDb-style rating" },
  { value: "primary_release_date.desc", label: "Newest first" },
  { value: "primary_release_date.asc", label: "Oldest first" },
  { value: "revenue.desc", label: "Box office" },
  { value: "vote_count.desc", label: "Most voted" },
] as const;

export function defaultFilters(): DiscoverFilters {
  return {
    query: "",
    titleKind: "movie",
    genres: [],
    withoutGenres: [],
    yearMin: 2000,
    yearMax: new Date().getFullYear(),
    ratingMin: 7,
    ratingMax: 10,
    voteCountMin: 1000,
    runtimeMin: null,
    runtimeMax: null,
    language: "en",
    cast: [],
    directors: [],
    keywords: [],
    providers: [],
    sortBy: "match",
    hideWatched: true,
    hideWatchlist: false,
    page: 1,
  };
}

export const DEFAULT_IMDB_API_URL = "http://127.0.0.1:3847";

export function defaultSettings(): Settings {
  return {
    tmdbApiKey: "",
    region: "US",
    rankingMode: "balanced",
    imdbApiUrl: DEFAULT_IMDB_API_URL,
    themeMode: "dark",
    accentColor: DEFAULT_ACCENT_COLOR,
  };
}

export function normalizeSettings(raw?: Partial<Settings> | null): Settings {
  const merged = { ...defaultSettings(), ...raw };
  return {
    ...merged,
    themeMode: normalizeThemeMode(merged.themeMode),
    accentColor: normalizeAccentColor(merged.accentColor),
  };
}

export function posterUrl(
  path: string | null | undefined,
  size = "w342",
): string | null {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export function imdbUrl(imdbId?: string): string | null {
  if (!imdbId) return null;
  return `https://www.imdb.com/title/${imdbId}/`;
}

export function mediaTypeOf(kind?: TitleKind | MediaType): MediaType {
  return kind === "tv" || kind === "miniseries" ? "tv" : "movie";
}

export function titleKey(title: {
  tmdbId: number;
  mediaType?: MediaType;
}): string {
  return `${title.mediaType ?? "movie"}:${title.tmdbId}`;
}

export function titleKindLabel(kind?: TitleKind): string {
  if (kind === "tv") return "TV Series";
  if (kind === "miniseries") return "Mini-Series";
  return "Movie";
}

export function formatSeasons(count?: number): string | null {
  if (!count || count <= 0) return null;
  return count === 1 ? "1 season" : `${count} seasons`;
}

export function formatRuntime(minutes?: number): string | null {
  if (!minutes || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours && mins) return `${hours}h ${mins}m`;
  if (hours) return `${hours}h`;
  return `${mins}m`;
}

export function formatVotes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 100) / 10}k`;
  return `${n}`;
}

export function sortMovies<T extends MovieSummary & { match?: number }>(
  movies: T[],
  sortBy: string,
): T[] {
  const compare = movieComparator(sortBy);
  if (!compare) return [...movies];
  return [...movies].sort(compare);
}

function movieComparator(
  sortBy: string,
):
  | ((
      a: MovieSummary & { match?: number },
      b: MovieSummary & { match?: number },
    ) => number)
  | null {
  const byId = (a: MovieSummary, b: MovieSummary): number =>
    titleKey(a).localeCompare(titleKey(b)) || a.tmdbId - b.tmdbId;
  switch (sortBy) {
    case "match":
      return (a, b) =>
        n(b.match) - n(a.match) ||
        n(b.voteAverage) - n(a.voteAverage) ||
        n(b.voteCount) - n(a.voteCount) ||
        byId(a, b);
    case "vote_average.desc":
      return (a, b) =>
        ratingTenths(b.voteAverage) - ratingTenths(a.voteAverage) ||
        n(b.voteCount) - n(a.voteCount) ||
        n(b.voteAverage) - n(a.voteAverage) ||
        byId(a, b);
    case "vote_count.desc":
      return (a, b) =>
        n(b.voteCount) - n(a.voteCount) ||
        n(b.voteAverage) - n(a.voteAverage) ||
        byId(a, b);
    case "popularity.desc":
      return (a, b) => n(b.popularity) - n(a.popularity) || byId(a, b);
    case "primary_release_date.desc":
      return (a, b) =>
        (b.releaseDate || "").localeCompare(a.releaseDate || "") || byId(a, b);
    case "primary_release_date.asc":
      return (a, b) =>
        (a.releaseDate || "").localeCompare(b.releaseDate || "") || byId(a, b);
    default:
      return null;
  }
}

function n(value: unknown): number {
  const next = typeof value === "number" ? value : Number(value);
  return Number.isFinite(next) ? next : 0;
}

function ratingTenths(value: unknown): number {
  return Math.round(n(value) * 10);
}

export function yearOf(date?: string): number | undefined {
  if (!date || date.length < 4) return undefined;
  const year = Number(date.slice(0, 4));
  return Number.isFinite(year) ? year : undefined;
}
