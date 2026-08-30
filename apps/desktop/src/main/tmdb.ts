import {
  mediaTypeOf,
  sortMovies,
  yearOf,
  type CastMember,
  type DiscoverFilters,
  type Genre,
  type KeywordRef,
  type MediaType,
  type MovieDetails,
  type MovieSummary,
  type PersonRef,
  type TitleKind,
  type WatchProvider,
} from "../shared/types";

const BASE = "https://api.themoviedb.org/3";
const runtimeCache = new Map<string, number | null>();
const certificationCache = new Map<string, string | null>();
const creditsCache = new Map<string, CreditsMeta | null>();
const seasonCache = new Map<string, number | null>();
const episodeCache = new Map<string, number | null>();
const metaInflight = new Map<string, Promise<void>>();
const detailsCache = new Map<string, MovieDetails>();
const detailsInflight = new Map<string, Promise<MovieDetails>>();
const imdbIdCache = new Map<string, string | null>();
const imdbIdInflight = new Map<string, Promise<string | undefined>>();
let persistImdbId: ((key: string, imdbId: string) => void) | undefined;

export function setImdbIdPersister(
  save: (key: string, imdbId: string) => void,
): void {
  persistImdbId = save;
}

export function hydrateImdbIds(ids: Record<string, string>): void {
  for (const [key, imdbId] of Object.entries(ids)) {
    storeImdbId(key, imdbId, false);
  }
}

export class TmdbError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export interface CreditsMeta {
  directorIds: number[];
  directorNames: string[];
  castIds: number[];
  castNames: string[];
}

export interface MovieMeta {
  runtime?: number;
  certification?: string;
  directorIds?: number[];
  directorNames?: string[];
  castIds?: number[];
  castNames?: string[];
  seasonCount?: number;
  episodeCount?: number;
}

export class TmdbClient {
  constructor(
    private apiKey: string,
    private region = "US",
  ) {}

  configured(): boolean {
    return Boolean(this.apiKey?.trim());
  }

  private async get<T>(
    path: string,
    params: Record<string, string | number | boolean | undefined> = {},
  ): Promise<T> {
    if (!this.configured()) {
      throw new TmdbError(
        "Add a TMDB API key in Settings to search IMDb-linked titles.",
        401,
      );
    }

    const url = new URL(`${BASE}${path}`);
    url.searchParams.set("api_key", this.apiKey.trim());
    url.searchParams.set("language", "en-US");
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === "" || value === null) continue;
      url.searchParams.set(key, String(value));
    }

    // TMDB uses "|" for OR. URLSearchParams encodes it as %7C, which the API treats as AND.
    const href = url.toString().replaceAll("%7C", "|");

    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(href, {
        headers: { Accept: "application/json" },
      });
      if (res.status === 429) {
        await sleep(400 * (attempt + 1));
        continue;
      }
      if (!res.ok) {
        const body = await res.text();
        throw new TmdbError(parseTmdbMessage(body, res.status), res.status);
      }
      return (await res.json()) as T;
    }
    throw (
      lastError ??
      new TmdbError("TMDB rate limit exceeded. Try again in a moment.", 429)
    );
  }

  genres(mediaType: MediaType = "movie"): Promise<{ genres: Genre[] }> {
    return this.get(
      mediaType === "tv" ? "/genre/tv/list" : "/genre/movie/list",
    );
  }

  providers(region: string): Promise<{ results: WatchProvider[] }> {
    return this.get("/watch/providers/movie", { watch_region: region });
  }

  async searchPeople(query: string): Promise<PersonRef[]> {
    if (!query.trim()) return [];
    const data = await this.get<{
      results: Array<{ id: number; name: string }>;
    }>("/search/person", {
      query: query.trim(),
      include_adult: false,
    });
    return data.results.slice(0, 8).map((p) => ({ id: p.id, name: p.name }));
  }

  async searchKeywords(query: string): Promise<KeywordRef[]> {
    if (!query.trim()) return [];
    const data = await this.get<{ results: KeywordRef[] }>("/search/keyword", {
      query: query.trim(),
    });
    return data.results.slice(0, 8);
  }

  async findByImdb(
    imdbId: string,
    preferred: MediaType = "movie",
  ): Promise<MovieSummary | null> {
    const data = await this.get<{
      movie_results: TmdbMovie[];
      tv_results: TmdbTv[];
    }>(`/find/${encodeURIComponent(imdbId)}`, { external_source: "imdb_id" });
    const movie = data.movie_results?.[0];
    const show = data.tv_results?.[0];
    const id = normalizeImdbId(imdbId);
    if (preferred === "tv") {
      if (show) {
        storeImdbId(cacheKey("tv", show.id), id);
        return { ...toTvSummary(show), imdbId: id };
      }
      if (movie) {
        storeImdbId(cacheKey("movie", movie.id), id);
        return { ...toSummary(movie), imdbId: id };
      }
      return null;
    }
    if (movie) {
      storeImdbId(cacheKey("movie", movie.id), id);
      return { ...toSummary(movie), imdbId: id };
    }
    if (show) {
      storeImdbId(cacheKey("tv", show.id), id);
      return { ...toTvSummary(show), imdbId: id };
    }
    return null;
  }

  async searchMovies(query: string, page: number): Promise<TmdbPage> {
    const data = await this.get<TmdbPageRaw>("/search/movie", {
      query,
      page,
      include_adult: false,
    });
    return mapPage(data);
  }

  async searchTv(
    query: string,
    page: number,
    titleKind: TitleKind = "tv",
  ): Promise<TmdbPage> {
    const data = await this.get<TmdbTvPageRaw>("/search/tv", {
      query,
      page,
      include_adult: false,
    });
    return mapTvPage(data, titleKind);
  }

  async discover(filters: DiscoverFilters, page: number): Promise<TmdbPage> {
    if (mediaTypeOf(filters.titleKind) === "tv")
      return this.discoverTv(filters, page);
    if (filters.genres.length > 1) {
      const pages = await Promise.all(
        filters.genres.map((id) =>
          this.discover({ ...filters, genres: [id] }, page),
        ),
      );
      return mergePages(pages, page, filters.sortBy);
    }

    const params: Record<string, string | number | boolean | undefined> = {
      page,
      include_adult: false,
      include_video: false,
      sort_by: movieSort(filters.sortBy),
      "vote_count.gte": tmdbVoteCountFloor(filters.voteCountMin),
    };

    if (filters.yearMin)
      params["primary_release_date.gte"] = `${filters.yearMin}-01-01`;
    if (filters.yearMax)
      params["primary_release_date.lte"] = `${filters.yearMax}-12-31`;
    if (filters.runtimeMin) params["with_runtime.gte"] = filters.runtimeMin;
    if (filters.runtimeMax) params["with_runtime.lte"] = filters.runtimeMax;
    if (filters.language) params.with_original_language = filters.language;
    if (filters.genres.length === 1)
      params.with_genres = String(filters.genres[0]);
    if (filters.withoutGenres.length)
      params.without_genres = filters.withoutGenres.join(",");
    if (filters.cast.length)
      params.with_cast = filters.cast.map((p) => p.id).join(",");
    if (filters.directors.length)
      params.with_crew = filters.directors.map((p) => p.id).join(",");
    if (filters.keywords.length)
      params.with_keywords = filters.keywords.map((k) => k.id).join(",");
    if (filters.providers.length) {
      params.with_watch_providers = filters.providers.join("|");
      params.watch_region = "US";
    }

    const data = await this.get<TmdbPageRaw>("/discover/movie", params);
    return mapPage(data);
  }

  private async discoverTv(
    filters: DiscoverFilters,
    page: number,
  ): Promise<TmdbPage> {
    if (filters.genres.length > 1) {
      const pages = await Promise.all(
        filters.genres.map((id) =>
          this.discoverTv({ ...filters, genres: [id] }, page),
        ),
      );
      return mergePages(pages, page, filters.sortBy);
    }

    const params: Record<string, string | number | boolean | undefined> = {
      page,
      include_adult: false,
      sort_by: tvSort(filters.sortBy),
      "vote_count.gte": tmdbVoteCountFloor(filters.voteCountMin),
    };

    if (filters.titleKind === "miniseries") params.with_type = 2;
    if (filters.yearMin)
      params["first_air_date.gte"] = `${filters.yearMin}-01-01`;
    if (filters.yearMax)
      params["first_air_date.lte"] = `${filters.yearMax}-12-31`;
    if (filters.runtimeMin) params["with_runtime.gte"] = filters.runtimeMin;
    if (filters.runtimeMax) params["with_runtime.lte"] = filters.runtimeMax;
    if (filters.language) params.with_original_language = filters.language;
    if (filters.genres.length === 1)
      params.with_genres = String(filters.genres[0]);
    if (filters.withoutGenres.length)
      params.without_genres = filters.withoutGenres.join(",");
    if (filters.cast.length)
      params.with_cast = filters.cast.map((p) => p.id).join(",");
    if (filters.keywords.length)
      params.with_keywords = filters.keywords.map((k) => k.id).join(",");
    if (filters.providers.length) {
      params.with_watch_providers = filters.providers.join("|");
      params.watch_region = "US";
    }

    const data = await this.get<TmdbTvPageRaw>("/discover/tv", params);
    return mapTvPage(
      data,
      filters.titleKind === "miniseries" ? "miniseries" : "tv",
    );
  }

  async title(
    id: number,
    mediaType: MediaType = "movie",
  ): Promise<MovieDetails> {
    return mediaType === "tv" ? this.tv(id) : this.movie(id);
  }

  async movie(id: number): Promise<MovieDetails> {
    return this.loadDetails("movie", id, () =>
      this.get<TmdbDetails>(`/movie/${id}`, {
        append_to_response: "credits,external_ids,keywords,release_dates",
      }).then((data) => toDetails(data, this.region)),
    );
  }

  async tv(id: number): Promise<MovieDetails> {
    return this.loadDetails("tv", id, () =>
      this.get<TmdbTvDetails>(`/tv/${id}`, {
        append_to_response:
          "aggregate_credits,credits,external_ids,keywords,content_ratings",
      }).then((data) => toTvDetails(data, this.region)),
    );
  }

  private async loadDetails(
    mediaType: MediaType,
    id: number,
    fetchDetails: () => Promise<MovieDetails>,
  ): Promise<MovieDetails> {
    const key = cacheKey(mediaType, id);
    const cached = detailsCache.get(key);
    if (cached) return cached;
    const pending = detailsInflight.get(key);
    if (pending) return pending;
    const request = fetchDetails()
      .then((details) => {
        detailsCache.set(key, details);
        rememberMeta(
          key,
          details.runtime ?? null,
          details.certification ?? null,
        );
        rememberCounts(
          key,
          details.seasonCount ?? null,
          details.episodeCount ?? null,
        );
        storeCredits(key, creditsFromDetails(details));
        storeImdbId(key, details.imdbId);
        return details;
      })
      .finally(() => {
        detailsInflight.delete(key);
      });
    detailsInflight.set(key, request);
    return request;
  }

  async recommendations(
    id: number,
    page = 1,
    mediaType: MediaType = "movie",
  ): Promise<MovieSummary[]> {
    const path =
      mediaType === "tv"
        ? `/tv/${id}/recommendations`
        : `/movie/${id}/recommendations`;
    if (mediaType === "tv") {
      const data = await this.get<TmdbTvPageRaw>(path, { page });
      return mapTvPage(data, "tv").results;
    }
    const data = await this.get<TmdbPageRaw>(path, { page });
    return mapPage(data).results;
  }

  async similar(
    id: number,
    page = 1,
    mediaType: MediaType = "movie",
  ): Promise<MovieSummary[]> {
    const path =
      mediaType === "tv" ? `/tv/${id}/similar` : `/movie/${id}/similar`;
    if (mediaType === "tv") {
      const data = await this.get<TmdbTvPageRaw>(path, { page });
      return mapTvPage(data, "tv").results;
    }
    const data = await this.get<TmdbPageRaw>(path, { page });
    return mapPage(data).results;
  }

  rememberRuntime(
    id: number,
    runtime?: number,
    mediaType: MediaType = "movie",
  ): void {
    rememberMeta(cacheKey(mediaType, id), runtime, undefined);
  }

  rememberCertification(
    id: number,
    certification?: string,
    mediaType: MediaType = "movie",
  ): void {
    rememberMeta(cacheKey(mediaType, id), undefined, certification);
  }

  rememberCredits(
    id: number,
    credits?: CreditsMeta | null,
    mediaType: MediaType = "movie",
  ): void {
    storeCredits(cacheKey(mediaType, id), credits);
  }

  rememberImdbId(
    id: number,
    imdbId?: string,
    mediaType: MediaType = "movie",
  ): void {
    storeImdbId(cacheKey(mediaType, id), imdbId);
  }

  imdbIdOf(id: number, mediaType: MediaType = "movie"): string | undefined {
    return imdbIdCache.get(cacheKey(mediaType, id)) ?? undefined;
  }

  async externalIds(
    id: number,
    mediaType: MediaType = "movie",
  ): Promise<string | undefined> {
    const key = cacheKey(mediaType, id);
    if (imdbIdCache.has(key)) return imdbIdCache.get(key) ?? undefined;
    const pending = imdbIdInflight.get(key);
    if (pending) return pending;

    const request = this.get<{ imdb_id?: string | null }>(
      mediaType === "tv"
        ? `/tv/${id}/external_ids`
        : `/movie/${id}/external_ids`,
    )
      .then((data) => {
        const imdbId = normalizeImdbId(data.imdb_id);
        if (imdbId) storeImdbId(key, imdbId);
        else if (!imdbIdCache.has(key)) imdbIdCache.set(key, null);
        return imdbId ?? undefined;
      })
      .catch(() => {
        if (!imdbIdCache.has(key)) imdbIdCache.set(key, null);
        return undefined;
      })
      .finally(() => {
        imdbIdInflight.delete(key);
      });

    imdbIdInflight.set(key, request);
    return request;
  }

  async resolveImdbIds(movies: MovieSummary[]): Promise<MovieSummary[]> {
    const queue = movies.filter((movie) => !normalizeImdbId(movie.imdbId));
    const workerCount = Math.min(6, queue.length);
    await Promise.all(
      Array.from({ length: workerCount }, async () => {
        while (queue.length) {
          const movie = queue.shift();
          if (movie == null) return;
          await this.externalIds(movie.tmdbId, movie.mediaType ?? "movie");
        }
      }),
    );
    return movies.map((movie) => ({
      ...movie,
      imdbId:
        normalizeImdbId(movie.imdbId) ??
        imdbIdCache.get(cacheKey(movie.mediaType ?? "movie", movie.tmdbId)) ??
        undefined,
    }));
  }

  runtimeOf(id: number, mediaType: MediaType = "movie"): number | undefined {
    return runtimeCache.get(cacheKey(mediaType, id)) ?? undefined;
  }

  certificationOf(
    id: number,
    mediaType: MediaType = "movie",
  ): string | undefined {
    return certificationCache.get(cacheKey(mediaType, id)) ?? undefined;
  }

  creditsOf(
    id: number,
    mediaType: MediaType = "movie",
  ): CreditsMeta | undefined {
    const key = cacheKey(mediaType, id);
    return (
      creditsCache.get(key) ??
      creditsFromDetails(detailsCache.get(key)) ??
      undefined
    );
  }

  hydrateMovie(
    movie: MovieSummary,
    library?: {
      runtime?: number;
      certification?: string;
      seasonCount?: number;
      episodeCount?: number;
    } & Partial<CreditsMeta>,
  ): MovieSummary {
    const mediaType = movie.mediaType ?? "movie";
    const credits = this.creditsOf(movie.tmdbId, mediaType);
    const key = cacheKey(mediaType, movie.tmdbId);
    return {
      ...movie,
      imdbId: movie.imdbId ?? imdbIdCache.get(key) ?? undefined,
      runtime:
        movie.runtime ??
        this.runtimeOf(movie.tmdbId, mediaType) ??
        library?.runtime,
      certification:
        movie.certification ??
        this.certificationOf(movie.tmdbId, mediaType) ??
        library?.certification,
      directorIds: firstCredits(
        movie.directorIds,
        credits?.directorIds,
        library?.directorIds,
      ),
      directorNames: firstCredits(
        movie.directorNames,
        credits?.directorNames,
        library?.directorNames,
      ),
      castIds: firstCredits(movie.castIds, credits?.castIds, library?.castIds),
      castNames: firstCredits(
        movie.castNames,
        credits?.castNames,
        library?.castNames,
      ),
      seasonCount:
        movie.seasonCount ??
        seasonCache.get(key) ??
        library?.seasonCount ??
        undefined,
      episodeCount:
        movie.episodeCount ??
        episodeCache.get(key) ??
        library?.episodeCount ??
        undefined,
    };
  }

  metaOf(id: number, mediaType: MediaType = "movie"): MovieMeta {
    const credits = this.creditsOf(id, mediaType);
    const key = cacheKey(mediaType, id);
    return {
      runtime: this.runtimeOf(id, mediaType),
      certification: this.certificationOf(id, mediaType),
      directorIds: credits?.directorIds,
      directorNames: credits?.directorNames,
      castIds: credits?.castIds,
      castNames: credits?.castNames,
      seasonCount: seasonCache.get(key) ?? undefined,
      episodeCount: episodeCache.get(key) ?? undefined,
    };
  }

  async prefetchRuntimes(ids: number[]): Promise<void> {
    await this.prefetchMovieMeta(
      ids.map((tmdbId) => ({
        tmdbId,
        mediaType: "movie" as const,
        titleKind: "movie" as const,
      })),
    );
  }

  async prefetchMovieMeta(
    movies: Array<Pick<MovieSummary, "tmdbId" | "mediaType">>,
  ): Promise<Record<string, MovieMeta>> {
    const unique = [
      ...new Map(
        movies.map((movie) => [
          cacheKey(movie.mediaType ?? "movie", movie.tmdbId),
          movie,
        ]),
      ).values(),
    ];
    const missing = unique.filter((movie) => {
      const key = cacheKey(movie.mediaType ?? "movie", movie.tmdbId);
      const needsMeta =
        !runtimeCache.has(key) ||
        !certificationCache.has(key) ||
        !creditsCache.has(key);
      const needsImdb = !imdbIdCache.has(key);
      return needsMeta || needsImdb;
    });
    const queue = [...missing];
    const workerCount = Math.min(6, queue.length);
    await Promise.all(
      Array.from({ length: workerCount }, async () => {
        while (queue.length) {
          const movie = queue.shift();
          if (movie == null) return;
          const mediaType = movie.mediaType ?? "movie";
          const key = cacheKey(mediaType, movie.tmdbId);
          const needsMeta =
            !runtimeCache.has(key) ||
            !certificationCache.has(key) ||
            !creditsCache.has(key);
          if (needsMeta) await this.ensureMeta(movie.tmdbId, mediaType);
          if (!imdbIdCache.has(key))
            await this.externalIds(movie.tmdbId, mediaType);
        }
      }),
    );
    return Object.fromEntries(
      unique.map((movie) => {
        const mediaType = movie.mediaType ?? "movie";
        return [
          cacheKey(mediaType, movie.tmdbId),
          this.metaOf(movie.tmdbId, mediaType),
        ];
      }),
    );
  }

  private async ensureMeta(id: number, mediaType: MediaType): Promise<void> {
    const key = cacheKey(mediaType, id);
    if (
      runtimeCache.has(key) &&
      certificationCache.has(key) &&
      creditsCache.has(key)
    )
      return;
    const pending = metaInflight.get(key);
    if (pending) return pending;
    const request = (
      mediaType === "tv"
        ? this.get<{
            episode_run_time?: number[];
            number_of_seasons?: number;
            number_of_episodes?: number;
            content_ratings?: TmdbContentRatings;
            credits?: TmdbDetails["credits"];
            aggregate_credits?: TmdbTvDetails["aggregate_credits"];
            created_by?: Array<{ id: number; name: string }>;
            external_ids?: { imdb_id?: string | null };
          }>(`/tv/${id}`, {
            append_to_response:
              "credits,aggregate_credits,content_ratings,external_ids",
          })
        : this.get<{
            runtime: number | null;
            release_dates?: TmdbReleaseDates;
            credits?: TmdbDetails["credits"];
            external_ids?: { imdb_id?: string | null };
            imdb_id?: string | null;
          }>(`/movie/${id}`, {
            append_to_response: "credits,release_dates,external_ids",
          })
    )
      .then((data) => {
        if (mediaType === "tv") {
          const tv = data as TmdbTvDetails;
          rememberMeta(
            key,
            episodeRuntime(tv.episode_run_time),
            pickTvCertification(tv.content_ratings, this.region) ?? null,
          );
          rememberCounts(
            key,
            tv.number_of_seasons ?? null,
            tv.number_of_episodes ?? null,
          );
          storeCredits(key, creditsFromTvPayload(tv));
          storeImdbId(key, tv.external_ids?.imdb_id);
          return;
        }
        const movie = data as {
          runtime: number | null;
          release_dates?: TmdbReleaseDates;
          credits?: TmdbDetails["credits"];
          external_ids?: { imdb_id?: string | null };
          imdb_id?: string | null;
        };
        rememberMeta(
          key,
          movie.runtime && movie.runtime > 0 ? movie.runtime : null,
          pickCertification(movie.release_dates, this.region) ?? null,
        );
        storeCredits(key, creditsFromPayload(movie.credits));
        storeImdbId(key, movie.external_ids?.imdb_id || movie.imdb_id);
      })
      .catch(() => {
        if (!runtimeCache.has(key)) runtimeCache.set(key, null);
        if (!certificationCache.has(key)) certificationCache.set(key, null);
        if (!creditsCache.has(key)) creditsCache.set(key, null);
      })
      .finally(() => {
        metaInflight.delete(key);
      });
    metaInflight.set(key, request);
    return request;
  }
}

interface TmdbMovie {
  adult: boolean;
  backdrop_path: string | null;
  genre_ids?: number[];
  id: number;
  original_language: string;
  original_title: string;
  overview: string;
  popularity: number;
  poster_path: string | null;
  release_date: string;
  title: string;
  vote_average: number;
  vote_count: number;
}

interface TmdbTv {
  adult?: boolean;
  backdrop_path: string | null;
  genre_ids?: number[];
  id: number;
  original_language: string;
  original_name: string;
  overview: string;
  popularity: number;
  poster_path: string | null;
  first_air_date?: string;
  name: string;
  vote_average: number;
  vote_count: number;
}

interface TmdbPageRaw {
  page: number;
  total_pages: number;
  total_results: number;
  results: TmdbMovie[];
}

interface TmdbTvPageRaw {
  page: number;
  total_pages: number;
  total_results: number;
  results: TmdbTv[];
}

export interface TmdbPage {
  page: number;
  totalPages: number;
  totalResults: number;
  results: MovieSummary[];
}

interface TmdbDetails extends TmdbMovie {
  imdb_id?: string;
  runtime: number | null;
  tagline?: string;
  status?: string;
  budget?: number;
  revenue?: number;
  homepage?: string;
  genres?: Genre[];
  external_ids?: { imdb_id?: string };
  credits?: {
    cast: Array<{
      id: number;
      name: string;
      character: string;
      order: number;
      profile_path: string | null;
    }>;
    crew: Array<{ id: number; name: string; job: string }>;
  };
  keywords?: { keywords: KeywordRef[] };
  release_dates?: TmdbReleaseDates;
}

interface TmdbTvDetails extends TmdbTv {
  episode_run_time?: number[];
  number_of_seasons?: number;
  number_of_episodes?: number;
  created_by?: Array<{ id: number; name: string }>;
  tagline?: string;
  status?: string;
  homepage?: string;
  type?: string;
  genres?: Genre[];
  external_ids?: { imdb_id?: string };
  credits?: TmdbDetails["credits"];
  aggregate_credits?: {
    cast: Array<{
      id: number;
      name: string;
      total_episode_count?: number;
      roles?: Array<{ character: string }>;
      profile_path: string | null;
      order?: number;
    }>;
    crew: Array<{ id: number; name: string; jobs?: Array<{ job: string }> }>;
  };
  keywords?: { results?: KeywordRef[]; keywords?: KeywordRef[] };
  content_ratings?: TmdbContentRatings;
}

interface TmdbReleaseDates {
  results: TmdbReleaseCountry[];
}

interface TmdbReleaseCountry {
  iso_3166_1: string;
  release_dates: Array<{
    certification: string;
    type: number;
  }>;
}

interface TmdbContentRatings {
  results: Array<{ iso_3166_1: string; rating: string }>;
}

function toSummary(movie: TmdbMovie): MovieSummary {
  return {
    tmdbId: movie.id,
    mediaType: "movie",
    titleKind: "movie",
    title: movie.title,
    originalTitle: movie.original_title,
    overview: movie.overview ?? "",
    posterPath: movie.poster_path,
    backdropPath: movie.backdrop_path,
    releaseDate: movie.release_date ?? "",
    year: yearOf(movie.release_date),
    genreIds: movie.genre_ids ?? [],
    originalLanguage: movie.original_language,
    popularity: movie.popularity ?? 0,
    voteAverage: movie.vote_average ?? 0,
    voteCount: movie.vote_count ?? 0,
    adult: movie.adult,
  };
}

function toTvSummary(show: TmdbTv, titleKind: TitleKind = "tv"): MovieSummary {
  return {
    tmdbId: show.id,
    mediaType: "tv",
    titleKind: titleKind === "miniseries" ? "miniseries" : "tv",
    title: show.name,
    originalTitle: show.original_name,
    overview: show.overview ?? "",
    posterPath: show.poster_path,
    backdropPath: show.backdrop_path,
    releaseDate: show.first_air_date ?? "",
    year: yearOf(show.first_air_date),
    genreIds: show.genre_ids ?? [],
    originalLanguage: show.original_language,
    popularity: show.popularity ?? 0,
    voteAverage: show.vote_average ?? 0,
    voteCount: show.vote_count ?? 0,
    adult: show.adult ?? false,
  };
}

function mapPage(data: TmdbPageRaw): TmdbPage {
  return {
    page: data.page,
    totalPages: Math.min(data.total_pages ?? 1, 500),
    totalResults: data.total_results ?? 0,
    results: (data.results ?? []).map(toSummary),
  };
}

function mapTvPage(data: TmdbTvPageRaw, titleKind: TitleKind): TmdbPage {
  return {
    page: data.page,
    totalPages: Math.min(data.total_pages ?? 1, 500),
    totalResults: data.total_results ?? 0,
    results: (data.results ?? []).map((show) => toTvSummary(show, titleKind)),
  };
}

function mergePages(pages: TmdbPage[], page: number, sortBy: string): TmdbPage {
  const seen = new Set<string>();
  const results: MovieSummary[] = [];
  for (const group of pages) {
    for (const movie of group.results) {
      const key = `${movie.mediaType}:${movie.tmdbId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(movie);
    }
  }
  return {
    page,
    totalPages: Math.max(1, ...pages.map((group) => group.totalPages)),
    totalResults: pages.reduce((sum, group) => sum + group.totalResults, 0),
    results: sortMovies(results, sortBy),
  };
}

function toDetails(data: TmdbDetails, region: string): MovieDetails {
  const directors = (data.credits?.crew ?? [])
    .filter((c) => c.job === "Director")
    .map((c) => ({ id: c.id, name: c.name }));
  const cast: CastMember[] = (data.credits?.cast ?? [])
    .slice(0, 16)
    .map((c) => ({
      id: c.id,
      name: c.name,
      character: c.character,
      order: c.order,
      profilePath: c.profile_path,
    }));
  const genres = data.genres ?? [];
  return {
    ...toSummary({ ...data, genre_ids: genres.map((g) => g.id) }),
    imdbId: data.external_ids?.imdb_id || data.imdb_id || undefined,
    runtime: data.runtime ?? undefined,
    certification: pickCertification(data.release_dates, region),
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
    castNames: cast.slice(0, 8).map((c) => c.name),
  };
}

function toTvDetails(data: TmdbTvDetails, region: string): MovieDetails {
  const creators = data.created_by ?? [];
  const crewDirectors = (
    data.aggregate_credits?.crew ??
    data.credits?.crew ??
    []
  )
    .filter((person) =>
      "jobs" in person
        ? (person.jobs ?? []).some((job) => job.job === "Director")
        : (person as { job?: string }).job === "Director",
    )
    .map((person) => ({ id: person.id, name: person.name }));
  const directors = (creators.length ? creators : crewDirectors).map(
    (person) => ({
      id: person.id,
      name: person.name,
    }),
  );
  const aggregateCast = data.aggregate_credits?.cast ?? [];
  const cast: CastMember[] = (
    aggregateCast.length ? aggregateCast : (data.credits?.cast ?? [])
  )
    .slice(0, 16)
    .map((person, index) => ({
      id: person.id,
      name: person.name,
      character:
        "roles" in person
          ? (person.roles?.[0]?.character ?? "")
          : (person.character ?? ""),
      order: person.order ?? index,
      profilePath: person.profile_path,
    }));
  const genres = data.genres ?? [];
  const titleKind: TitleKind = /mini/i.test(data.type ?? "")
    ? "miniseries"
    : "tv";
  return {
    ...toTvSummary({ ...data, genre_ids: genres.map((g) => g.id) }, titleKind),
    imdbId: data.external_ids?.imdb_id || undefined,
    runtime: episodeRuntime(data.episode_run_time),
    certification: pickTvCertification(data.content_ratings, region),
    tagline: data.tagline,
    status: data.status,
    homepage: data.homepage,
    genres,
    directors,
    cast,
    keywords: data.keywords?.results ?? data.keywords?.keywords ?? [],
    directorIds: directors.map((d) => d.id),
    directorNames: directors.map((d) => d.name),
    castIds: cast.slice(0, 8).map((c) => c.id),
    castNames: cast.slice(0, 8).map((c) => c.name),
    seasonCount: data.number_of_seasons,
    episodeCount: data.number_of_episodes,
  };
}

function storeCredits(key: string, credits?: CreditsMeta | null): void {
  if (credits == null) {
    if (!creditsCache.has(key)) creditsCache.set(key, null);
    return;
  }
  if (!credits.directorIds.length && !credits.castIds.length) {
    if (!creditsCache.has(key)) creditsCache.set(key, null);
    return;
  }
  const current = creditsCache.get(key);
  if (!current) creditsCache.set(key, credits);
}

function creditsFromDetails(details?: MovieDetails): CreditsMeta | undefined {
  if (!details) return undefined;
  if (!details.directorIds?.length && !details.castIds?.length)
    return undefined;
  return {
    directorIds: details.directorIds ?? [],
    directorNames: details.directorNames ?? [],
    castIds: details.castIds ?? [],
    castNames: details.castNames ?? [],
  };
}

function creditsFromPayload(
  credits?: TmdbDetails["credits"],
): CreditsMeta | null {
  const directors = (credits?.crew ?? []).filter(
    (person) => person.job === "Director",
  );
  const cast = (credits?.cast ?? []).slice(0, 8);
  if (!directors.length && !cast.length) return null;
  return {
    directorIds: directors.map((person) => person.id),
    directorNames: directors.map((person) => person.name),
    castIds: cast.map((person) => person.id),
    castNames: cast.map((person) => person.name),
  };
}

function creditsFromTvPayload(data: {
  created_by?: Array<{ id: number; name: string }>;
  credits?: TmdbDetails["credits"];
  aggregate_credits?: TmdbTvDetails["aggregate_credits"];
}): CreditsMeta | null {
  const creators = data.created_by ?? [];
  const directors = creators.length
    ? creators
    : (data.credits?.crew ?? []).filter((person) => person.job === "Director");
  const cast = (data.aggregate_credits?.cast ?? data.credits?.cast ?? []).slice(
    0,
    8,
  );
  if (!directors.length && !cast.length) return null;
  return {
    directorIds: directors.map((person) => person.id),
    directorNames: directors.map((person) => person.name),
    castIds: cast.map((person) => person.id),
    castNames: cast.map((person) => person.name),
  };
}

function firstCredits<T>(
  ...candidates: Array<T[] | undefined>
): T[] | undefined {
  return candidates.find((value) => value != null && value.length > 0);
}

function rememberMeta(
  key: string,
  runtime?: number | null,
  certification?: string | null,
): void {
  if (runtime != null && runtime > 0 && !runtimeCache.has(key))
    runtimeCache.set(key, runtime);
  if (runtime === null && !runtimeCache.has(key)) runtimeCache.set(key, null);
  if (certification && !certificationCache.has(key))
    certificationCache.set(key, certification);
  if (certification === null && !certificationCache.has(key))
    certificationCache.set(key, null);
}

function rememberCounts(
  key: string,
  seasons?: number | null,
  episodes?: number | null,
): void {
  if (seasons != null && seasons > 0 && !seasonCache.has(key))
    seasonCache.set(key, seasons);
  if (seasons === null && !seasonCache.has(key)) seasonCache.set(key, null);
  if (episodes != null && episodes > 0 && !episodeCache.has(key))
    episodeCache.set(key, episodes);
  if (episodes === null && !episodeCache.has(key)) episodeCache.set(key, null);
}

function pickCertification(
  data: TmdbReleaseDates | undefined,
  region: string,
): string | undefined {
  const groups = data?.results ?? [];
  if (!groups.length) return undefined;
  const wanted = (region || "US").toUpperCase();
  const ordered = [
    ...groups.filter((group) => group.iso_3166_1 === wanted),
    ...(wanted !== "US"
      ? groups.filter((group) => group.iso_3166_1 === "US")
      : []),
    ...groups.filter(
      (group) => group.iso_3166_1 !== wanted && group.iso_3166_1 !== "US",
    ),
  ];
  for (const group of ordered) {
    const dates = group.release_dates ?? [];
    const theatrical = dates.find(
      (entry) =>
        (entry.type === 2 || entry.type === 3) &&
        cleanCert(entry.certification),
    );
    const any = dates.find((entry) => cleanCert(entry.certification));
    const value =
      cleanCert(theatrical?.certification) ?? cleanCert(any?.certification);
    if (value) return value;
  }
  return undefined;
}

function pickTvCertification(
  data: TmdbContentRatings | undefined,
  region: string,
): string | undefined {
  const groups = data?.results ?? [];
  if (!groups.length) return undefined;
  const wanted = (region || "US").toUpperCase();
  const ordered = [
    ...groups.filter((group) => group.iso_3166_1 === wanted),
    ...(wanted !== "US"
      ? groups.filter((group) => group.iso_3166_1 === "US")
      : []),
    ...groups.filter(
      (group) => group.iso_3166_1 !== wanted && group.iso_3166_1 !== "US",
    ),
  ];
  for (const group of ordered) {
    const value = cleanCert(group.rating);
    if (value) return value;
  }
  return undefined;
}

function episodeRuntime(values?: number[]): number | undefined {
  const runtime = (values ?? []).find((value) => value > 0);
  return runtime && runtime > 0 ? runtime : undefined;
}

function tmdbVoteCountFloor(voteCountMin: number): number {
  return Math.max(0, Math.floor(voteCountMin * 0.5));
}

function normalizeImdbId(value?: string | null): string | undefined {
  const id = value?.trim();
  return id && /^tt\d+$/i.test(id) ? id.toLowerCase() : undefined;
}

function storeImdbId(
  key: string,
  imdbId?: string | null,
  persist = true,
): void {
  const normalized = normalizeImdbId(imdbId);
  if (!normalized) return;
  if (!imdbIdCache.has(key)) imdbIdCache.set(key, normalized);
  if (persist) persistImdbId?.(key, normalized);
}

function movieSort(sortBy: string): string {
  return sortBy === "match" ? "popularity.desc" : sortBy;
}

function tvSort(sortBy: string): string {
  if (sortBy === "match" || sortBy === "revenue.desc") return "popularity.desc";
  return sortBy.replace("primary_release_date", "first_air_date");
}

function cacheKey(mediaType: MediaType, id: number): string {
  return `${mediaType}:${id}`;
}

function cleanCert(value?: string): string | undefined {
  const cert = value?.trim();
  return cert || undefined;
}

function parseTmdbMessage(body: string, status: number): string {
  try {
    const json = JSON.parse(body) as { status_message?: string };
    if (json.status_message) return json.status_message;
  } catch {
    /* ignore */
  }
  if (status === 401) return "TMDB rejected the API key. Check Settings.";
  return `TMDB request failed (${status})`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
