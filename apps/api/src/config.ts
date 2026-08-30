import { join } from "node:path";

export const PORT = Number(process.env.PORT) || 3847;
export const DATASET_URL =
  process.env.IMDB_RATINGS_URL ??
  "https://datasets.imdbws.com/title.ratings.tsv.gz";
export const DATA_DIR =
  process.env.IMDB_DATA_DIR ?? join(process.cwd(), "data");
export const DATASET_FILE = "title.ratings.tsv.gz";
export const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const MAX_RATING_IDS = 200;
