# Local catalog API

The API persists its self-hosted catalog in SQLite at `CATALOG_DB_PATH` (default:
`data/catalog.sqlite` relative to the process working directory). Migrations run
automatically when the service starts, or explicitly with `npm run migrate -w
@imdbrain/api`.

## Build from IMDb datasets

`npm run build:catalog` (or `npm run build:catalog -w @imdbrain/api`) downloads
IMDb’s non-commercial dumps into `data/` and rebuilds the SQLite catalog:

- `title.basics.tsv.gz` — movies, TV series, and mini-series (non-adult, with ratings)
- `title.ratings.tsv.gz` — IMDb rating and vote count
- `title.crew.tsv.gz` — directors
- `title.principals.tsv.gz` + `name.basics.tsv.gz` — top billed cast

Existing library entries are preserved when the title still exists after the
rebuild. Poster URLs already stored on matching titles are restored as well.
Use `--force` to re-download dumps even if they are less than a day old.

## TMDB posters

`npm run enrich:posters` looks up each catalog title on TMDB by IMDb ID and
writes `https://image.tmdb.org/t/p/original/...` into `poster_url`. Titles are
processed from most-voted to least so Discover fills in first. The job is
resumable: rows that already have a poster URL (or an empty string after a
confirmed miss) are skipped.

Set `TMDB_API_KEY`, or keep a TMDB key in the desktop settings file. Optional
`TMDB_CONCURRENCY` (default 10) controls parallel lookups.

## Licensed overlay

`POST /v1/imports/catalog` accepts a provider-neutral, licensed-bundle manifest
for fields IMDb dumps do not include (posters, synopses, and similar). It
intentionally does not implement any external vendor format. The request is
validated, limited to 50,000 titles, and replaces the metadata, genres, cast,
and directors for each supplied title.

```json
{
  "version": 1,
  "titles": [{
    "id": "tt0111161",
    "title": "The Shawshank Redemption",
    "kind": "movie",
    "year": 1994,
    "runtimeMinutes": 142,
    "genres": ["Drama"],
    "directors": ["Frank Darabont"],
    "cast": ["Tim Robbins", "Morgan Freeman"]
  }]
}
```

The `201` response includes an import id; retrieve it using
`GET /v1/imports/:id`. Imports complete synchronously for now, so the returned
status will ordinarily be `completed`.

IMDb ratings remain synchronized through the existing `POST /sync` endpoint and
startup/daily job. Ratings are stored in memory for legacy `POST /ratings`
lookups and are also applied to catalog titles that are already imported.
