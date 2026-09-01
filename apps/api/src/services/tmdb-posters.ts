import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  TMDB_API_BASE,
  TMDB_IMAGE_BASE,
  TMDB_POSTER_CONCURRENCY,
} from "../config.js";
import type { CatalogDatabase } from "./catalog-db.js";

interface FindResponse {
  movie_results?: Array<{ poster_path?: string | null }>;
  tv_results?: Array<{ poster_path?: string | null }>;
}

export interface PosterEnrichmentResult {
  processed: number;
  found: number;
  missing: number;
  errors: number;
}

export async function enrichPosters(
  catalog: CatalogDatabase,
  options: { apiKey?: string; concurrency?: number } = {},
): Promise<PosterEnrichmentResult> {
  const apiKey = options.apiKey ?? readTmdbApiKey();
  const concurrency = options.concurrency ?? TMDB_POSTER_CONCURRENCY;
  const pending = catalog.listTitlesNeedingPosters();
  const stats: PosterEnrichmentResult = {
    processed: 0,
    found: 0,
    missing: 0,
    errors: 0,
  };
  if (!pending.length) {
    log("No titles left without a poster lookup");
    return stats;
  }

  log(
    `Looking up TMDB posters for ${pending.length.toLocaleString()} titles (${concurrency} workers)`,
  );
  let cursor = 0;
  let batch: Array<{ id: string; posterUrl: string | null }> = [];
  const flush = (): void => {
    if (!batch.length) return;
    catalog.updatePosterUrls(batch);
    batch = [];
  };

  const workers = Array.from({ length: Math.min(concurrency, pending.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= pending.length) return;
      const title = pending[index];
      try {
        const posterUrl = await findPoster(apiKey, title.id, title.kind);
        batch.push({ id: title.id, posterUrl });
        if (posterUrl) stats.found += 1;
        else stats.missing += 1;
      } catch (error) {
        stats.errors += 1;
        log(
          `Failed ${title.id}: ${error instanceof Error ? error.message : "unknown error"}`,
        );
      }
      stats.processed += 1;
      if (batch.length >= 100) flush();
      if (stats.processed % 250 === 0) {
        log(
          `Progress ${stats.processed.toLocaleString()}/${pending.length.toLocaleString()} · found ${stats.found.toLocaleString()} · none ${stats.missing.toLocaleString()} · errors ${stats.errors}`,
        );
      }
    }
  });

  const stop = (): void => {
    flush();
    log(
      `Stopped after ${stats.processed.toLocaleString()} lookups (${stats.found.toLocaleString()} posters saved)`,
    );
  };
  process.once("SIGINT", () => {
    log("Interrupt received; flushing poster writes");
    cursor = pending.length;
  });

  await Promise.all(workers);
  flush();
  stop();
  return stats;
}

async function findPoster(
  apiKey: string,
  imdbId: string,
  kind: string,
): Promise<string | null> {
  const url = new URL(`${TMDB_API_BASE}/find/${encodeURIComponent(imdbId)}`);
  url.searchParams.set("external_source", "imdb_id");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("language", "en-US");

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("retry-after"));
      await sleep((Number.isFinite(retryAfter) ? retryAfter : 1 + attempt) * 1000);
      continue;
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error("TMDB rejected the API key");
    }
    if (!response.ok) {
      lastError = new Error(`TMDB find failed (${response.status})`);
      await sleep(300 * (attempt + 1));
      continue;
    }
    const data = (await response.json()) as FindResponse;
    const preferred =
      kind === "tv" || kind === "miniseries"
        ? [...(data.tv_results ?? []), ...(data.movie_results ?? [])]
        : [...(data.movie_results ?? []), ...(data.tv_results ?? [])];
    const posterPath = preferred.find((item) => item.poster_path)?.poster_path;
    return posterPath ? `${TMDB_IMAGE_BASE}${posterPath}` : null;
  }
  throw lastError ?? new Error("TMDB rate limit exceeded");
}

export function readTmdbApiKey(): string {
  const fromEnv = process.env.TMDB_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  const appData = process.env.APPDATA;
  if (appData) {
    const file = join(appData, "imdbrain", "imdbrain.json");
    if (existsSync(file)) {
      const raw = JSON.parse(readFileSync(file, "utf8")) as {
        settings?: { tmdbApiKey?: string };
      };
      const key = raw.settings?.tmdbApiKey?.trim();
      if (key) return key;
    }
  }
  throw new Error(
    "Set TMDB_API_KEY, or keep a TMDB key in the desktop app settings file.",
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(message: string): void {
  console.log(`[posters] ${message}`);
}
