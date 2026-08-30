import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  statSync,
} from "node:fs";
import { rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import {
  DATA_DIR,
  DATASET_FILE,
  DATASET_URL,
  SYNC_INTERVAL_MS,
} from "../config.js";
import type { ImdbRating } from "../types.js";
import type { RatingsStore } from "./ratings-store.js";

const IMDB_ID = /^tt\d+$/i;

let inflight: Promise<void> | null = null;

export function datasetPath(): string {
  return join(DATA_DIR, DATASET_FILE);
}

export function syncDataset(store: RatingsStore, force = false): Promise<void> {
  if (inflight) return inflight;
  inflight = ensureDataset(store, force).finally(() => {
    inflight = null;
  });
  return inflight;
}

async function ensureDataset(
  store: RatingsStore,
  force: boolean,
): Promise<void> {
  mkdirSync(DATA_DIR, { recursive: true });
  const file = datasetPath();
  const present = existsSync(file);

  if (present && !store.ready()) {
    await loadFromFile(store, file);
  }

  if (!force && present && !isStale(file) && store.ready()) return;

  try {
    await downloadDataset(file);
    await loadFromFile(store, file);
  } catch (error) {
    if (store.ready()) {
      console.warn(
        "IMDb ratings refresh failed; keeping the last loaded dataset.",
        error,
      );
      return;
    }
    throw error;
  }
}

function isStale(file: string): boolean {
  return Date.now() - statSync(file).mtimeMs >= SYNC_INTERVAL_MS;
}

async function downloadDataset(file: string): Promise<void> {
  const response = await fetch(DATASET_URL, {
    headers: { Accept: "application/gzip" },
  });
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download IMDb ratings (${response.status})`);
  }

  const tmp = `${file}.${process.pid}.tmp`;
  try {
    await pipeline(
      Readable.fromWeb(
        response.body as import("node:stream/web").ReadableStream,
      ),
      createWriteStream(tmp),
    );
    await rename(tmp, file);
  } catch (error) {
    if (existsSync(tmp)) await unlink(tmp).catch(() => undefined);
    throw error;
  }
}

async function loadFromFile(store: RatingsStore, file: string): Promise<void> {
  const ratings = await parseRatingsTsv(file);
  if (!ratings.size) throw new Error("IMDb ratings file parsed empty");
  store.replace(ratings, new Date().toISOString());
}

export async function parseRatingsTsv(
  file: string,
): Promise<Map<string, ImdbRating>> {
  const ratings = new Map<string, ImdbRating>();
  const lines = createInterface({
    input: createReadStream(file).pipe(createGunzip()),
    crlfDelay: Infinity,
  });

  let header = true;
  for await (const line of lines) {
    if (header) {
      header = false;
      continue;
    }
    if (!line) continue;
    const [tconst, averageRating, numVotes] = line.split("\t");
    if (!tconst || !IMDB_ID.test(tconst)) continue;
    const rating = Number(averageRating);
    const votes = Number(numVotes);
    if (!Number.isFinite(rating) || !Number.isFinite(votes)) continue;
    ratings.set(tconst.toLowerCase(), { rating, votes });
  }

  return ratings;
}
