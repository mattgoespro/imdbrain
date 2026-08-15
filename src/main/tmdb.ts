import type {
  CastMember,
  DiscoverFilters,
  Genre,
  KeywordRef,
  MovieDetails,
  MovieSummary,
  PersonRef,
  WatchProvider
} from '../shared/types'
import { yearOf } from '../shared/types'

const BASE = 'https://api.themoviedb.org/3'

export class TmdbError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export class TmdbClient {
  constructor(private apiKey: string) {}

  configured(): boolean {
    return Boolean(this.apiKey?.trim())
  }

  private async get<T>(path: string, params: Record<string, string | number | boolean | undefined> = {}): Promise<T> {
    if (!this.configured()) {
      throw new TmdbError('Add a TMDB API key in Settings to search IMDb-linked titles.', 401)
    }

    const url = new URL(`${BASE}${path}`)
    url.searchParams.set('api_key', this.apiKey.trim())
    url.searchParams.set('language', 'en-US')
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === '' || value === null) continue
      url.searchParams.set(key, String(value))
    }

    let lastError: Error | null = null
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(url, { headers: { Accept: 'application/json' } })
      if (res.status === 429) {
        await sleep(400 * (attempt + 1))
        continue
      }
      if (!res.ok) {
        const body = await res.text()
        throw new TmdbError(parseTmdbMessage(body, res.status), res.status)
      }
      return (await res.json()) as T
    }
    throw lastError ?? new TmdbError('TMDB rate limit exceeded. Try again in a moment.', 429)
  }

  genres(): Promise<{ genres: Genre[] }> {
    return this.get('/genre/movie/list')
  }

  providers(region: string): Promise<{ results: WatchProvider[] }> {
    return this.get('/watch/providers/movie', { watch_region: region })
  }

  async searchPeople(query: string): Promise<PersonRef[]> {
    if (!query.trim()) return []
    const data = await this.get<{ results: Array<{ id: number; name: string }> }>('/search/person', {
      query: query.trim(),
      include_adult: false
    })
    return data.results.slice(0, 8).map((p) => ({ id: p.id, name: p.name }))
  }

  async searchKeywords(query: string): Promise<KeywordRef[]> {
    if (!query.trim()) return []
    const data = await this.get<{ results: KeywordRef[] }>('/search/keyword', { query: query.trim() })
    return data.results.slice(0, 8)
  }

  async findByImdb(imdbId: string): Promise<MovieSummary | null> {
    const data = await this.get<{
      movie_results: TmdbMovie[]
    }>(`/find/${encodeURIComponent(imdbId)}`, { external_source: 'imdb_id' })
    const movie = data.movie_results[0]
    return movie ? toSummary(movie) : null
  }

  async searchMovies(query: string, page: number): Promise<TmdbPage> {
    const data = await this.get<TmdbPageRaw>('/search/movie', {
      query,
      page,
      include_adult: false
    })
    return mapPage(data)
  }

  async discover(filters: DiscoverFilters, page: number): Promise<TmdbPage> {
    const params: Record<string, string | number | boolean | undefined> = {
      page,
      include_adult: false,
      include_video: false,
      sort_by: filters.sortBy === 'match' ? 'popularity.desc' : filters.sortBy,
      'vote_count.gte': filters.voteCountMin,
      'vote_average.gte': filters.ratingMin,
      'vote_average.lte': filters.ratingMax
    }

    if (filters.yearMin) params['primary_release_date.gte'] = `${filters.yearMin}-01-01`
    if (filters.yearMax) params['primary_release_date.lte'] = `${filters.yearMax}-12-31`
    if (filters.runtimeMin) params['with_runtime.gte'] = filters.runtimeMin
    if (filters.runtimeMax) params['with_runtime.lte'] = filters.runtimeMax
    if (filters.language) params.with_original_language = filters.language
    if (filters.genres.length) params.with_genres = filters.genres.join(',')
    if (filters.withoutGenres.length) params.without_genres = filters.withoutGenres.join(',')
    if (filters.cast.length) params.with_cast = filters.cast.map((p) => p.id).join(',')
    if (filters.directors.length) params.with_crew = filters.directors.map((p) => p.id).join(',')
    if (filters.keywords.length) params.with_keywords = filters.keywords.map((k) => k.id).join(',')
    if (filters.providers.length) {
      params.with_watch_providers = filters.providers.join('|')
      params.watch_region = 'US'
    }

    const data = await this.get<TmdbPageRaw>('/discover/movie', params)
    return mapPage(data)
  }

  async movie(id: number): Promise<MovieDetails> {
    const data = await this.get<TmdbDetails>(`/movie/${id}`, {
      append_to_response: 'credits,external_ids,keywords'
    })
    return toDetails(data)
  }

  async recommendations(id: number, page = 1): Promise<MovieSummary[]> {
    const data = await this.get<TmdbPageRaw>(`/movie/${id}/recommendations`, { page })
    return mapPage(data).results
  }

  async similar(id: number, page = 1): Promise<MovieSummary[]> {
    const data = await this.get<TmdbPageRaw>(`/movie/${id}/similar`, { page })
    return mapPage(data).results
  }
}

interface TmdbMovie {
  adult: boolean
  backdrop_path: string | null
  genre_ids?: number[]
  id: number
  original_language: string
  original_title: string
  overview: string
  popularity: number
  poster_path: string | null
  release_date: string
  title: string
  vote_average: number
  vote_count: number
}

interface TmdbPageRaw {
  page: number
  total_pages: number
  total_results: number
  results: TmdbMovie[]
}

export interface TmdbPage {
  page: number
  totalPages: number
  totalResults: number
  results: MovieSummary[]
}

interface TmdbDetails extends TmdbMovie {
  imdb_id?: string
  runtime: number | null
  tagline?: string
  status?: string
  budget?: number
  revenue?: number
  homepage?: string
  genres?: Genre[]
  external_ids?: { imdb_id?: string }
  credits?: {
    cast: Array<{
      id: number
      name: string
      character: string
      order: number
      profile_path: string | null
    }>
    crew: Array<{ id: number; name: string; job: string }>
  }
  keywords?: { keywords: KeywordRef[] }
}

function toSummary(movie: TmdbMovie): MovieSummary {
  return {
    tmdbId: movie.id,
    title: movie.title,
    originalTitle: movie.original_title,
    overview: movie.overview ?? '',
    posterPath: movie.poster_path,
    backdropPath: movie.backdrop_path,
    releaseDate: movie.release_date ?? '',
    year: yearOf(movie.release_date),
    genreIds: movie.genre_ids ?? [],
    originalLanguage: movie.original_language,
    popularity: movie.popularity,
    voteAverage: movie.vote_average,
    voteCount: movie.vote_count,
    adult: movie.adult
  }
}

function mapPage(data: TmdbPageRaw): TmdbPage {
  return {
    page: data.page,
    totalPages: Math.min(data.total_pages ?? 1, 500),
    totalResults: data.total_results ?? 0,
    results: (data.results ?? []).map(toSummary)
  }
}

function toDetails(data: TmdbDetails): MovieDetails {
  const directors = (data.credits?.crew ?? [])
    .filter((c) => c.job === 'Director')
    .map((c) => ({ id: c.id, name: c.name }))
  const cast: CastMember[] = (data.credits?.cast ?? []).slice(0, 16).map((c) => ({
    id: c.id,
    name: c.name,
    character: c.character,
    order: c.order,
    profilePath: c.profile_path
  }))
  const genres = data.genres ?? []
  return {
    ...toSummary({ ...data, genre_ids: genres.map((g) => g.id) }),
    imdbId: data.external_ids?.imdb_id || data.imdb_id || undefined,
    runtime: data.runtime ?? undefined,
    tagline: data.tagline,
    status: data.status,
    budget: data.budget,
    revenue: data.revenue,
    homepage: data.homepage,
    genres,
    directors,
    cast,
    keywords: data.keywords?.keywords ?? [],
    directorIds: directors.map((d) => d.id),
    directorNames: directors.map((d) => d.name),
    castIds: cast.slice(0, 8).map((c) => c.id),
    castNames: cast.slice(0, 8).map((c) => c.name)
  }
}

function parseTmdbMessage(body: string, status: number): string {
  try {
    const json = JSON.parse(body) as { status_message?: string }
    if (json.status_message) return json.status_message
  } catch {
    /* ignore */
  }
  if (status === 401) return 'TMDB rejected the API key. Check Settings.'
  return `TMDB request failed (${status})`
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
