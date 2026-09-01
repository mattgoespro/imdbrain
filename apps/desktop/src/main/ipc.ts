import { BrowserWindow, dialog, ipcMain } from "electron";
import { readFileSync, writeFileSync } from "fs";
import {
  sortMovies,
  titleKey,
  type DiscoverFilters,
  type ForYouResult,
  type ImportProgress,
  type LibraryEntry,
  type MovieDetails,
  type MovieEnrichment,
  type MovieSummary,
  type Settings,
  type WatchStatus,
} from "../shared/types";
import { parseImdbRatingsCsv } from "./csv";
import { CatalogClient } from "./catalog-client";
import { buildProfile, describeProfile, publicProfile, scoreMovie } from "./ranking";
import { isAppearanceOnlyPatch } from "../shared/appearance";
import type { AppStore } from "./store";
import { applyWindowChrome } from "./window-chrome";

let store: AppStore;
let getWindow: () => BrowserWindow | null;

export function registerIpc(appStore: AppStore, windowGetter: () => BrowserWindow | null): void {
  store = appStore;
  getWindow = windowGetter;
  ipcMain.handle("settings:get", () => store.getSettings());
  ipcMain.handle("settings:set", (_event, patch: Partial<Settings>) => {
    const next = store.setSettings(patch);
    if (!isAppearanceOnlyPatch(patch)) void client().genres().catch(() => undefined);
    applyWindowChrome(getWindow(), next);
    return next;
  });
  ipcMain.handle("catalog:configured", () => client().configured());
  ipcMain.handle("catalog:genres", () => client().genres());
  ipcMain.handle("catalog:providers", () => []);
  ipcMain.handle("catalog:searchPeople", () => []);
  ipcMain.handle("catalog:searchKeywords", () => []);
  ipcMain.handle("catalog:discover", (_event, filters: DiscoverFilters) => discover(filters));
  ipcMain.handle("catalog:title", (_event, imdbId: string) => client().title(imdbId));
  ipcMain.handle("catalog:movieMeta", (_event, movies: MovieSummary[]) => enrichMovies(movies));
  ipcMain.handle("library:list", () => client().listLibrary());
  ipcMain.handle("library:upsert", (_event, payload: LibraryUpsert) => upsertLibrary(payload));
  ipcMain.handle("library:remove", async (_event, imdbId: string) => {
    await client().removeLibrary(imdbId);
    return client().listLibrary();
  });
  ipcMain.handle("library:clear", async () => {
    const entries = await client().listLibrary();
    await Promise.all(entries.map((entry) => client().removeLibrary(entry.imdbId)));
    return [];
  });
  ipcMain.handle("library:export", () => exportLibrary());
  ipcMain.handle("library:importImdbCsv", () => importImdbCsv());
  ipcMain.handle("ranking:forYou", () => forYou());
  ipcMain.handle("ranking:profile", async () => {
    const [library, genres] = await Promise.all([client().listLibrary(), client().genres()]);
    return publicProfile(buildProfile(library, genres));
  });
}

interface LibraryUpsert { movie: MovieSummary | MovieDetails; status: WatchStatus; rating?: number }

function client(): CatalogClient {
  return new CatalogClient(store.getSettings().catalogApiUrl);
}

async function discover(filters: DiscoverFilters) {
  return client().discover(filters);
}

async function upsertLibrary({ movie, status, rating }: LibraryUpsert): Promise<LibraryEntry[]> {
  await client().saveLibrary(movie as MovieSummary, status, rating);
  return client().listLibrary();
}

async function forYou(): Promise<ForYouResult> {
  const [library, genres, candidates] = await Promise.all([client().listLibrary(), client().genres(), client().listAll()]);
  const entries = new Map(library.map((entry) => [titleKey(entry), entry]));
  const profile = buildProfile(library, genres);
  const excluded = new Set(library.filter((entry) => entry.status === "watched" || entry.status === "skipped").map(titleKey));
  const movies = sortMovies(
    candidates.filter((movie) => !excluded.has(titleKey(movie))).map((movie) => scoreMovie(movie, profile, store.getSettings().rankingMode, entries)),
    "match",
  ).slice(0, 40);
  return { profile: publicProfile(profile), insights: describeProfile(profile), movies };
}

async function enrichMovies(movies: MovieSummary[]): Promise<Record<string, MovieEnrichment>> {
  const [library, genres] = await Promise.all([client().listLibrary(), client().genres()]);
  const entries = new Map(library.map((entry) => [titleKey(entry), entry]));
  const profile = buildProfile(library, genres);
  return Object.fromEntries(movies.map((movie) => {
    const ranked = scoreMovie(movie, profile, store.getSettings().rankingMode, entries);
    return [titleKey(movie), { match: ranked.match, reasons: ranked.reasons }];
  }));
}

async function exportLibrary(): Promise<{ ok: boolean; path?: string }> {
  const options = { title: "Export IMDBrain library", defaultPath: "imdbrain-library.json", filters: [{ name: "JSON", extensions: ["json"] }] };
  const window = getWindow();
  const result = window ? await dialog.showSaveDialog(window, options) : await dialog.showSaveDialog(options);
  if (result.canceled || !result.filePath) return { ok: false };
  writeFileSync(result.filePath, JSON.stringify({ exportedAt: new Date().toISOString(), library: await client().listLibrary() }, null, 2), "utf8");
  return { ok: true, path: result.filePath };
}

async function importImdbCsv(): Promise<ImportProgress> {
  const options = { title: "Import IMDb ratings.csv", filters: [{ name: "CSV", extensions: ["csv"] }], properties: ["openFile"] as Array<"openFile"> };
  const window = getWindow();
  const picked = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options);
  const empty: ImportProgress = { current: 0, total: 0, title: "", imported: 0, skipped: 0, errors: 0, done: true };
  if (picked.canceled || !picked.filePaths[0]) return empty;
  const rows = parseImdbRatingsCsv(readFileSync(picked.filePaths[0], "utf8"));
  const progress = { ...empty, total: rows.length, done: false };
  for (const [index, row] of rows.entries()) {
    progress.current = index + 1; progress.title = row.title; getWindow()?.webContents.send("library:importProgress", progress);
    try {
      const movie = await client().findByImdb(row.imdbId);
      if (!movie) progress.skipped++;
      else { await client().saveLibrary(movie, "watched", row.rating); progress.imported++; }
    } catch { progress.errors++; }
  }
  progress.done = true; progress.title = "Import complete"; getWindow()?.webContents.send("library:importProgress", progress);
  return progress;
}
