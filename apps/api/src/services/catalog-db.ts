import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type {
  FacetsResponse,
  ImportStatusDto,
  LibraryEntryDto,
  LibraryStatus,
  TitleDto,
  TitleListResponse,
} from "../catalog-types.js";

export interface CatalogTitleInput {
  id: string;
  title: string;
  originalTitle?: string | null;
  kind?: string;
  year?: number | null;
  runtimeMinutes?: number | null;
  synopsis?: string | null;
  posterUrl?: string | null;
  genres?: string[];
  directors?: string[];
  cast?: string[];
}

export interface TitleQuery {
  page: number;
  pageSize: number;
  sort: "title" | "year" | "rating" | "votes" | "updatedAt";
  order: "asc" | "desc";
  query?: string;
  genre?: string;
  kind?: string;
  yearMin?: number;
  yearMax?: number;
  ratingMin?: number;
  votesMin?: number;
  hideWatched?: boolean;
  hideWatchlist?: boolean;
  genres?: string[];
  runtimeMin?: number;
  runtimeMax?: number;
}

export interface CatalogMeta {
  builtAt: string | null;
  revision: string | null;
  source: string | null;
}

interface LibraryRow {
  title_id: string;
  status: LibraryStatus;
  personal_rating: number | null;
  note: string | null;
  updated_at: string;
}

export interface CatalogTitleRow {
  id: string;
  title: string;
  originalTitle: string | null;
  kind: string;
  year: number | null;
  runtimeMinutes: number | null;
  imdbRating: number | null;
  imdbVotes: number | null;
  genres: string[];
}

export interface CatalogPersonRow {
  titleId: string;
  name: string;
  role: "director" | "cast";
  position: number;
}

interface TitleRow {
  id: string; title: string; original_title: string | null; kind: string; year: number | null;
  runtime_minutes: number | null; synopsis: string | null; poster_url: string | null;
  imdb_rating: number | null; imdb_votes: number | null;
}

const migrations = [
  `CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS titles (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, original_title TEXT, kind TEXT NOT NULL DEFAULT 'movie',
    year INTEGER, runtime_minutes INTEGER, synopsis TEXT, poster_url TEXT,
    imdb_rating REAL, imdb_votes INTEGER, updated_at TEXT NOT NULL
   );
   CREATE TABLE IF NOT EXISTS title_genres (title_id TEXT NOT NULL REFERENCES titles(id) ON DELETE CASCADE, genre TEXT NOT NULL, PRIMARY KEY(title_id, genre));
   CREATE TABLE IF NOT EXISTS title_people (title_id TEXT NOT NULL REFERENCES titles(id) ON DELETE CASCADE, name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('director','cast')), position INTEGER NOT NULL, PRIMARY KEY(title_id, name, role));
   CREATE TABLE IF NOT EXISTS library_entries (
    title_id TEXT PRIMARY KEY REFERENCES titles(id) ON DELETE CASCADE, status TEXT NOT NULL CHECK(status IN ('watched','watchlist','skipped')),
    personal_rating REAL, note TEXT, updated_at TEXT NOT NULL
   );
   CREATE TABLE IF NOT EXISTS imports (
    id TEXT PRIMARY KEY, kind TEXT NOT NULL, status TEXT NOT NULL, started_at TEXT NOT NULL, finished_at TEXT,
    imported_titles INTEGER NOT NULL DEFAULT 0, message TEXT
   );
   CREATE INDEX IF NOT EXISTS titles_sort_idx ON titles(kind, year, imdb_rating, imdb_votes);
   CREATE INDEX IF NOT EXISTS title_genres_genre_idx ON title_genres(genre);`,
  `CREATE TABLE IF NOT EXISTS catalog_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
   CREATE INDEX IF NOT EXISTS titles_title_idx ON titles(title COLLATE NOCASE);
   CREATE INDEX IF NOT EXISTS titles_votes_idx ON titles(kind, imdb_votes);
   CREATE INDEX IF NOT EXISTS titles_runtime_idx ON titles(kind, runtime_minutes);`,
];

export class CatalogDatabase {
  private readonly db: Database.Database;

  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path);
    this.db.pragma("foreign_keys = ON");
    this.db.pragma("journal_mode = WAL");
    this.migrate();
  }

  private migrate(): void {
    this.db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)");
    migrations.forEach((sql, index) => {
      const version = index + 1;
      if (!this.db.prepare("SELECT 1 FROM schema_migrations WHERE version = ?").get(version)) {
        this.db.transaction(() => {
          this.db.exec(sql);
          this.db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)").run(version, now());
        })();
      }
    });
  }

  upsertTitles(titles: CatalogTitleInput[]): number {
    const upsert = this.db.prepare(`INSERT INTO titles(id,title,original_title,kind,year,runtime_minutes,synopsis,poster_url,updated_at)
      VALUES (@id,@title,@originalTitle,@kind,@year,@runtimeMinutes,@synopsis,@posterUrl,@updatedAt)
      ON CONFLICT(id) DO UPDATE SET title=excluded.title,original_title=excluded.original_title,kind=excluded.kind,year=excluded.year,runtime_minutes=excluded.runtime_minutes,synopsis=excluded.synopsis,poster_url=excluded.poster_url,updated_at=excluded.updated_at`);
    const clearGenres = this.db.prepare("DELETE FROM title_genres WHERE title_id = ?");
    const addGenre = this.db.prepare("INSERT OR IGNORE INTO title_genres(title_id, genre) VALUES (?, ?)");
    const clearPeople = this.db.prepare("DELETE FROM title_people WHERE title_id = ?");
    const addPerson = this.db.prepare("INSERT OR IGNORE INTO title_people(title_id, name, role, position) VALUES (?, ?, ?, ?)");
    this.db.transaction((items: CatalogTitleInput[]) => {
      for (const input of items) {
        upsert.run({ ...input, originalTitle: input.originalTitle ?? null, kind: input.kind ?? "movie", year: input.year ?? null, runtimeMinutes: input.runtimeMinutes ?? null, synopsis: input.synopsis ?? null, posterUrl: input.posterUrl ?? null, updatedAt: now() });
        clearGenres.run(input.id);
        for (const genre of input.genres ?? []) addGenre.run(input.id, genre);
        clearPeople.run(input.id);
        for (const [position, name] of (input.directors ?? []).entries()) addPerson.run(input.id, name, "director", position);
        for (const [position, name] of (input.cast ?? []).entries()) addPerson.run(input.id, name, "cast", position);
      }
    })(titles);
    return titles.length;
  }

  upsertRatings(ratings: Map<string, { rating: number; votes: number }>): number {
    const statement = this.db.prepare("UPDATE titles SET imdb_rating = ?, imdb_votes = ?, updated_at = ? WHERE id = ?");
    return this.db.transaction(() => {
      let updated = 0;
      for (const [id, rating] of ratings) updated += statement.run(rating.rating, rating.votes, now(), id.toLowerCase()).changes;
      return updated;
    })();
  }

  ratings(ids: string[]): Record<string, { rating: number; votes: number } | null> {
    const select = this.db.prepare("SELECT imdb_rating, imdb_votes FROM titles WHERE id = ?");
    return Object.fromEntries(ids.map((id) => {
      const row = select.get(id.toLowerCase()) as { imdb_rating: number | null; imdb_votes: number | null } | undefined;
      return [id, row?.imdb_rating == null || row.imdb_votes == null ? null : { rating: row.imdb_rating, votes: row.imdb_votes }];
    }));
  }

  listTitles(query: TitleQuery): TitleListResponse {
    const where: string[] = [];
    const params: Record<string, string | number> = {};
    if (query.query) { where.push("(t.title LIKE @query OR t.original_title LIKE @query OR t.id LIKE @query)"); params.query = `%${query.query}%`; }
    if (query.genres?.length) {
      const placeholders = query.genres.map((_, index) => {
        const key = `genre${index}`;
        params[key] = query.genres![index];
        return `@${key}`;
      });
      where.push(`EXISTS (SELECT 1 FROM title_genres g WHERE g.title_id=t.id AND g.genre IN (${placeholders.join(",")}))`);
    }
    if (query.kind) { where.push("t.kind=@kind"); params.kind = query.kind; }
    for (const [field, value] of [["year >= @yearMin", query.yearMin], ["year <= @yearMax", query.yearMax], ["imdb_rating >= @ratingMin", query.ratingMin], ["imdb_votes >= @votesMin", query.votesMin], ["runtime_minutes >= @runtimeMin", query.runtimeMin], ["runtime_minutes <= @runtimeMax", query.runtimeMax]] as const) if (value !== undefined) { where.push(`t.${field}`); params[field.match(/@(\w+)/)?.[1] ?? ""] = value; }
    where.push("NOT EXISTS (SELECT 1 FROM library_entries skipped WHERE skipped.title_id=t.id AND skipped.status='skipped')");
    if (query.hideWatched) where.push("NOT EXISTS (SELECT 1 FROM library_entries watched WHERE watched.title_id=t.id AND watched.status='watched')");
    if (query.hideWatchlist) where.push("NOT EXISTS (SELECT 1 FROM library_entries watchlist WHERE watchlist.title_id=t.id AND watchlist.status='watchlist')");
    const condition = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const orderColumn = { title: "t.title COLLATE NOCASE", year: "t.year", rating: "t.imdb_rating", votes: "t.imdb_votes", updatedAt: "t.updated_at" }[query.sort];
    const order = query.order.toUpperCase();
    const total = (this.db.prepare(`SELECT count(*) AS total FROM titles t ${condition}`).get(params) as { total: number }).total;
    const rows = this.db.prepare(`SELECT t.* FROM titles t ${condition} ORDER BY ${orderColumn} ${order}, t.id ASC LIMIT @limit OFFSET @offset`).all({ ...params, limit: query.pageSize, offset: (query.page - 1) * query.pageSize }) as TitleRow[];
    return { data: rows.map((row) => this.toTitle(row)), pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) } };
  }

  title(id: string): TitleDto | null {
    const row = this.db.prepare("SELECT * FROM titles WHERE id = ?").get(id.toLowerCase()) as TitleRow | undefined;
    return row ? this.toTitle(row) : null;
  }

  facets(): FacetsResponse {
    return {
      genres: this.db.prepare("SELECT genre AS value, count(*) AS count FROM title_genres GROUP BY genre ORDER BY count DESC, genre").all() as FacetsResponse["genres"],
      kinds: this.db.prepare("SELECT kind AS value, count(*) AS count FROM titles GROUP BY kind ORDER BY count DESC, kind").all() as FacetsResponse["kinds"],
      years: this.db.prepare("SELECT min(year) AS min, max(year) AS max FROM titles").get() as FacetsResponse["years"],
    };
  }

  listLibrary(status?: LibraryStatus): LibraryEntryDto[] {
    const rows = this.db.prepare(`SELECT l.status,l.personal_rating,l.note,l.updated_at,t.* FROM library_entries l JOIN titles t ON t.id=l.title_id ${status ? "WHERE l.status=?" : ""} ORDER BY l.updated_at DESC`).all(...(status ? [status] : [])) as Array<TitleRow & { status: LibraryStatus; personal_rating: number | null; note: string | null; updated_at: string }>;
    return rows.map((row) => ({ title: this.toTitle(row), status: row.status, personalRating: row.personal_rating, note: row.note, updatedAt: row.updated_at }));
  }

  saveLibrary(id: string, status: LibraryStatus, personalRating: number | null, note: string | null): LibraryEntryDto | null {
    if (!this.title(id)) return null;
    this.db.prepare(`INSERT INTO library_entries(title_id,status,personal_rating,note,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(title_id) DO UPDATE SET status=excluded.status,personal_rating=excluded.personal_rating,note=excluded.note,updated_at=excluded.updated_at`).run(id.toLowerCase(), status, personalRating, note, now());
    return this.listLibrary().find((entry) => entry.title.id === id.toLowerCase()) ?? null;
  }

  deleteLibrary(id: string): boolean { return this.db.prepare("DELETE FROM library_entries WHERE title_id = ?").run(id.toLowerCase()).changes > 0; }
  createImport(id: string, kind: ImportStatusDto["kind"]): void { this.db.prepare("INSERT INTO imports(id,kind,status,started_at) VALUES(?,?,'running',?)").run(id, kind, now()); }
  finishImport(id: string, status: ImportStatusDto["status"], importedTitles: number, message: string | null = null): void { this.db.prepare("UPDATE imports SET status=?,finished_at=?,imported_titles=?,message=? WHERE id=?").run(status, now(), importedTitles, message, id); }
  importStatus(id: string): ImportStatusDto | null {
    const row = this.db.prepare("SELECT * FROM imports WHERE id = ?").get(id) as { id: string; kind: ImportStatusDto["kind"]; status: ImportStatusDto["status"]; started_at: string; finished_at: string | null; imported_titles: number; message: string | null } | undefined;
    return row ? { id: row.id, kind: row.kind, status: row.status, startedAt: row.started_at, finishedAt: row.finished_at, importedTitles: row.imported_titles, message: row.message } : null;
  }

  titleCount(): number { return (this.db.prepare("SELECT count(*) AS count FROM titles").get() as { count: number }).count; }
  posterStats(): { total: number; pending: number; found: number; missing: number } {
    return this.db.prepare(`SELECT
      count(*) AS total,
      sum(CASE WHEN poster_url IS NULL THEN 1 ELSE 0 END) AS pending,
      sum(CASE WHEN poster_url IS NOT NULL AND poster_url != '' THEN 1 ELSE 0 END) AS found,
      sum(CASE WHEN poster_url = '' THEN 1 ELSE 0 END) AS missing
    FROM titles`).get() as { total: number; pending: number; found: number; missing: number };
  }
  listTitlesNeedingPosters(): Array<{ id: string; kind: string }> {
    return this.db.prepare(
      "SELECT id, kind FROM titles WHERE poster_url IS NULL ORDER BY imdb_votes DESC, id",
    ).all() as Array<{ id: string; kind: string }>;
  }
  snapshotPosterUrls(): Array<{ id: string; posterUrl: string }> {
    return this.db.prepare(
      "SELECT id, poster_url AS posterUrl FROM titles WHERE poster_url IS NOT NULL",
    ).all() as Array<{ id: string; posterUrl: string }>;
  }
  updatePosterUrls(rows: Array<{ id: string; posterUrl: string | null }>): void {
    if (!rows.length) return;
    const update = this.db.prepare("UPDATE titles SET poster_url = ? WHERE id = ?");
    this.db.transaction(() => {
      for (const row of rows) update.run(row.posterUrl ?? "", row.id);
    })();
  }
  catalogMeta(): CatalogMeta {
    const rows = this.db.prepare("SELECT key, value FROM catalog_meta").all() as Array<{ key: string; value: string }>;
    const values = Object.fromEntries(rows.map((row) => [row.key, row.value]));
    return {
      builtAt: values.builtAt ?? null,
      revision: values.revision ?? null,
      source: values.source ?? null,
    };
  }
  setCatalogMeta(meta: { builtAt: string; revision: string; source: string }): void {
    const upsert = this.db.prepare("INSERT INTO catalog_meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value");
    this.db.transaction(() => {
      upsert.run("builtAt", meta.builtAt);
      upsert.run("revision", meta.revision);
      upsert.run("source", meta.source);
    })();
  }

  snapshotLibrary(): LibraryRow[] {
    return this.db.prepare("SELECT title_id, status, personal_rating, note, updated_at FROM library_entries").all() as LibraryRow[];
  }

  startRebuild(): void {
    this.db.pragma("foreign_keys = OFF");
    this.db.pragma("synchronous = OFF");
    this.db.exec("DELETE FROM title_people; DELETE FROM title_genres; DELETE FROM titles;");
  }

  insertTitleRows(rows: CatalogTitleRow[]): void {
    if (!rows.length) return;
    const insert = this.db.prepare(`INSERT INTO titles(id,title,original_title,kind,year,runtime_minutes,synopsis,poster_url,imdb_rating,imdb_votes,updated_at)
      VALUES (@id,@title,@originalTitle,@kind,@year,@runtimeMinutes,NULL,NULL,@imdbRating,@imdbVotes,@updatedAt)`);
    const addGenre = this.db.prepare("INSERT OR IGNORE INTO title_genres(title_id, genre) VALUES (?, ?)");
    const updatedAt = now();
    this.db.transaction(() => {
      for (const row of rows) {
        insert.run({ ...row, updatedAt });
        for (const genre of row.genres) addGenre.run(row.id, genre);
      }
    })();
  }

  insertPeople(rows: CatalogPersonRow[]): void {
    if (!rows.length) return;
    const insert = this.db.prepare("INSERT OR IGNORE INTO title_people(title_id, name, role, position) VALUES (@titleId, @name, @role, @position)");
    this.db.transaction(() => {
      for (const row of rows) insert.run(row);
    })();
  }

  finishRebuild(library: LibraryRow[]): void {
    const restore = this.db.prepare(`INSERT INTO library_entries(title_id,status,personal_rating,note,updated_at)
      VALUES (@title_id,@status,@personal_rating,@note,@updated_at)`);
    const exists = this.db.prepare("SELECT 1 FROM titles WHERE id = ?");
    this.db.exec("DELETE FROM library_entries");
    this.db.transaction(() => {
      for (const entry of library) {
        if (exists.get(entry.title_id)) restore.run(entry);
      }
    })();
    this.db.pragma("synchronous = NORMAL");
    this.db.pragma("foreign_keys = ON");
    this.db.exec("ANALYZE");
  }

  close(): void { this.db.close(); }

  private toTitle(row: TitleRow): TitleDto {
    const people = this.db.prepare("SELECT name,role FROM title_people WHERE title_id=? ORDER BY role,position").all(row.id) as Array<{ name: string; role: "director" | "cast" }>;
    return { id: row.id, title: row.title, originalTitle: row.original_title, kind: row.kind, year: row.year, runtimeMinutes: row.runtime_minutes, synopsis: row.synopsis, posterUrl: row.poster_url, imdbRating: row.imdb_rating, imdbVotes: row.imdb_votes, genres: (this.db.prepare("SELECT genre FROM title_genres WHERE title_id=? ORDER BY genre").all(row.id) as Array<{ genre: string }>).map((genre) => genre.genre), directors: people.filter((person) => person.role === "director").map((person) => person.name), cast: people.filter((person) => person.role === "cast").map((person) => person.name) };
  }
}

function now(): string { return new Date().toISOString(); }
