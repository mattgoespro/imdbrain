import { join } from "node:path";
import { CATALOG_DB_PATH, DATA_DIR, DATASET_FILE, DATASET_URL, IMDB_DATASETS_BASE } from "../config.js";
import type { CatalogDatabase, CatalogPersonRow, CatalogTitleRow } from "./catalog-db.js";
import { parseRatingsTsv } from "./dataset.js";
import { ensureGzipFile, imdbValue, readTsvRows } from "./gzip-tsv.js";

const TITLE_FILES = {
  basics: "title.basics.tsv.gz",
  crew: "title.crew.tsv.gz",
  principals: "title.principals.tsv.gz",
  names: "name.basics.tsv.gz",
} as const;

const MAX_DIRECTORS = 4;
const MAX_CAST = 8;
const TITLE_BATCH = 2_000;
const PERSON_BATCH = 5_000;

interface Credit {
  nconst: string;
  ordering: number;
}

export interface CatalogBuildResult {
  titleCount: number;
  builtAt: string;
  revision: string;
}

export async function buildCatalog(
  catalog: CatalogDatabase,
  options: { force?: boolean } = {},
): Promise<CatalogBuildResult> {
  const force = options.force ?? false;
  const files = await downloadImdbFiles(force);
  log("Parsing IMDb ratings");
  const ratings = await parseRatingsTsv(files.ratings);
  log(`Loaded ${ratings.size.toLocaleString()} ratings`);

  const directors = new Map<string, Credit[]>();
  const cast = new Map<string, Credit[]>();
  const neededNames = new Set<string>();
  const library = catalog.snapshotLibrary();
  const posters = catalog.snapshotPosterUrls();

  catalog.startRebuild();
  try {
    log("Importing title.basics");
    const kept = await importBasics(catalog, files.basics, ratings);
    log(`Imported ${kept.size.toLocaleString()} titles`);
    catalog.updatePosterUrls(posters.filter((row) => kept.has(row.id)));

    log("Reading title.crew");
    await importCrew(files.crew, kept, directors, neededNames);
    log("Reading title.principals");
    await importPrincipals(files.principals, kept, cast, neededNames);
    log(`Resolving ${neededNames.size.toLocaleString()} names`);
    const names = await importNames(files.names, neededNames);
    log("Writing credits");
    insertCredits(catalog, directors, cast, names);
  } catch (error) {
    catalog.finishRebuild(library);
    throw error;
  }

  catalog.finishRebuild(library);
  const builtAt = new Date().toISOString();
  const revision = builtAt;
  catalog.setCatalogMeta({
    builtAt,
    revision,
    source: "imdb-noncommercial-datasets",
  });
  const titleCount = catalog.titleCount();
  log(`Catalog ready: ${titleCount.toLocaleString()} titles`);
  return { titleCount, builtAt, revision };
}

async function downloadImdbFiles(force: boolean): Promise<{
  ratings: string;
  basics: string;
  crew: string;
  principals: string;
  names: string;
}> {
  const ratings = join(DATA_DIR, DATASET_FILE);
  log(`Downloading ${DATASET_FILE}`);
  await ensureGzipFile(DATASET_URL, ratings, force);
  const files = { ratings } as {
    ratings: string;
    basics: string;
    crew: string;
    principals: string;
    names: string;
  };
  for (const [key, name] of Object.entries(TITLE_FILES) as Array<
    [keyof typeof TITLE_FILES, string]
  >) {
    log(`Downloading ${name}`);
    files[key] = await ensureGzipFile(
      `${IMDB_DATASETS_BASE}/${name}`,
      join(DATA_DIR, name),
      force,
    );
  }
  return files;
}

async function importBasics(
  catalog: CatalogDatabase,
  file: string,
  ratings: Map<string, { rating: number; votes: number }>,
): Promise<Set<string>> {
  const kept = new Set<string>();
  let batch: CatalogTitleRow[] = [];
  let scanned = 0;
  for await (const row of readTsvRows(file)) {
    scanned += 1;
    if (scanned % 1_000_000 === 0) log(`  scanned ${scanned.toLocaleString()} basics`);
    const id = imdbValue(row[0])?.toLowerCase();
    if (!id) continue;
    const kind = mapKind(row[1]);
    if (!kind) continue;
    if (row[4] === "1") continue;
    const score = ratings.get(id);
    if (!score) continue;
    const title = imdbValue(row[2]);
    if (!title) continue;
    kept.add(id);
    batch.push({
      id,
      title,
      originalTitle: imdbValue(row[3]),
      kind,
      year: parseYear(row[5]),
      runtimeMinutes: parseRuntime(row[7]),
      imdbRating: score.rating,
      imdbVotes: score.votes,
      genres: parseGenres(row[8]),
    });
    if (batch.length >= TITLE_BATCH) {
      catalog.insertTitleRows(batch);
      batch = [];
    }
  }
  catalog.insertTitleRows(batch);
  return kept;
}

async function importCrew(
  file: string,
  kept: Set<string>,
  directors: Map<string, Credit[]>,
  neededNames: Set<string>,
): Promise<void> {
  let scanned = 0;
  for await (const row of readTsvRows(file)) {
    scanned += 1;
    if (scanned % 1_000_000 === 0) log(`  scanned ${scanned.toLocaleString()} crew`);
    const id = imdbValue(row[0])?.toLowerCase();
    if (!id || !kept.has(id)) continue;
    const nconsts = (imdbValue(row[1]) ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter((value) => /^nm\d+$/i.test(value))
      .slice(0, MAX_DIRECTORS);
    if (!nconsts.length) continue;
    directors.set(
      id,
      nconsts.map((nconst, ordering) => ({ nconst, ordering })),
    );
    for (const nconst of nconsts) neededNames.add(nconst);
  }
}

async function importPrincipals(
  file: string,
  kept: Set<string>,
  cast: Map<string, Credit[]>,
  neededNames: Set<string>,
): Promise<void> {
  let scanned = 0;
  for await (const row of readTsvRows(file)) {
    scanned += 1;
    if (scanned % 5_000_000 === 0) log(`  scanned ${scanned.toLocaleString()} principals`);
    const id = imdbValue(row[0])?.toLowerCase();
    if (!id || !kept.has(id)) continue;
    const category = (row[3] ?? "").toLowerCase();
    if (category !== "actor" && category !== "actress") continue;
    const nconst = imdbValue(row[2])?.toLowerCase();
    if (!nconst || !/^nm\d+$/i.test(nconst)) continue;
    const ordering = Number(row[1]);
    const list = cast.get(id) ?? [];
    list.push({
      nconst,
      ordering: Number.isFinite(ordering) ? ordering : list.length,
    });
    if (list.length > MAX_CAST * 2) trimCredits(list, MAX_CAST);
    cast.set(id, list);
  }
  for (const [id, list] of cast) {
    trimCredits(list, MAX_CAST);
    if (!list.length) {
      cast.delete(id);
      continue;
    }
    for (const credit of list) neededNames.add(credit.nconst);
  }
}

async function importNames(
  file: string,
  neededNames: Set<string>,
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  let scanned = 0;
  for await (const row of readTsvRows(file)) {
    scanned += 1;
    if (scanned % 1_000_000 === 0) log(`  scanned ${scanned.toLocaleString()} names`);
    const nconst = imdbValue(row[0])?.toLowerCase();
    if (!nconst || !neededNames.has(nconst)) continue;
    const name = imdbValue(row[1]);
    if (name) names.set(nconst, name);
    if (names.size === neededNames.size) break;
  }
  return names;
}

function insertCredits(
  catalog: CatalogDatabase,
  directors: Map<string, Credit[]>,
  cast: Map<string, Credit[]>,
  names: Map<string, string>,
): void {
  let batch: CatalogPersonRow[] = [];
  const flush = (): void => {
    catalog.insertPeople(batch);
    batch = [];
  };
  const push = (titleId: string, credits: Credit[], role: "director" | "cast"): void => {
    credits.forEach((credit, position) => {
      const name = names.get(credit.nconst);
      if (!name) return;
      batch.push({ titleId, name, role, position });
      if (batch.length >= PERSON_BATCH) flush();
    });
  };
  for (const [titleId, credits] of directors) push(titleId, credits, "director");
  for (const [titleId, credits] of cast) {
    trimCredits(credits, MAX_CAST);
    push(titleId, credits, "cast");
  }
  flush();
}

function trimCredits(list: Credit[], max: number): void {
  list.sort((a, b) => a.ordering - b.ordering || a.nconst.localeCompare(b.nconst));
  const seen = new Set<string>();
  let write = 0;
  for (const credit of list) {
    if (seen.has(credit.nconst)) continue;
    seen.add(credit.nconst);
    list[write] = credit;
    write += 1;
    if (write >= max) break;
  }
  list.length = write;
}

function mapKind(titleType: string | undefined): string | null {
  switch ((titleType ?? "").toLowerCase()) {
    case "movie":
      return "movie";
    case "tvseries":
      return "tv";
    case "tvminiseries":
      return "miniseries";
    default:
      return null;
  }
}

function parseYear(value: string | undefined): number | null {
  const year = Number(imdbValue(value));
  return Number.isInteger(year) && year >= 1870 && year <= 3000 ? year : null;
}

function parseRuntime(value: string | undefined): number | null {
  const runtime = Number(imdbValue(value));
  return Number.isInteger(runtime) && runtime > 0 && runtime <= 2000 ? runtime : null;
}

function parseGenres(value: string | undefined): string[] {
  const raw = imdbValue(value);
  if (!raw) return [];
  return [...new Set(raw.split(",").map((genre) => genre.trim()).filter(Boolean))];
}

function log(message: string): void {
  console.log(`[catalog] ${message}`);
}

export function defaultCatalogPath(): string {
  return CATALOG_DB_PATH;
}
