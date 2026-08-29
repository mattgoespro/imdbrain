# IMDBrain

Windows desktop app for **advanced IMDb-linked movie search** and **personal ranking** based on what you rate, watch, skip, and binge.

Official IMDb search APIs are not publicly available. IMDBrain uses [TMDB](https://www.themoviedb.org/) as the catalog (titles include IMDb IDs), opens films on IMDb, and can import your IMDb `ratings.csv`.

A local Express API in `apps/api` overlays **current IMDb ratings and vote counts** from IMDb’s official daily [non-commercial `title.ratings` dataset](https://developer.imdb.com/non-commercial-datasets/) so Discover sort and match scores are not stuck on stale TMDB votes.

## Features

- **Advanced search** — title or `tt` IMDb ID, include/exclude genres, year window, rating and vote floors, runtime, language, cast, director, keywords, streaming services, hide watched/watchlist
- **Best match sort** — re-ranks search results against your taste model
- **Live IMDb ratings** — patches TMDB list scores with the daily IMDb ratings dump before ranking
- **Ranked for you** — recommendations seeded from highly rated movies, then scored with genre affinity, directors, cast, era, runtime habits, and recent watch streaks
- **Watch patterns** — local library of watched / watchlist / skipped titles with ratings
- **IMDb import** — load IMDb’s ratings export to train the ranker immediately
- **Ranking modes** — balanced, more of the same, or surprise me

## Run on Windows

1. Install Node.js 20+.
2. Create a free TMDB API key: [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api)
3. From this folder:

```bash
npm install
npm run dev
```

That starts the ratings API (`http://127.0.0.1:3847`) and the Electron app. The API downloads `title.ratings.tsv.gz` on first run (IMDb non-commercial use). If the API is offline, the desktop app keeps using TMDB scores.

4. In **Settings**, paste the TMDB API key and save. The ratings API URL defaults to `http://127.0.0.1:3847`.
5. Rate a few movies you already know (or import `ratings.csv` from IMDb).
6. Open **Ranked for you**.

Individual processes:

```bash
npm run dev:api
npm run dev:desktop
```

### Windows installer

```bash
npm run build:win
```

The NSIS setup lands in `apps/desktop/dist/`. The packaged app does not start the ratings API; run `npm run dev:api` (or `npm start -w @imdbrain/api`) alongside it if you want live IMDb scores.

## Ranking model

Each candidate title gets a 1–99 match score from:

| Signal | What it uses |
| --- | --- |
| Genre taste | Your ratings vs your personal average, confidence-weighted |
| Directors / cast | People who show up in films you score highly |
| Era | Decade affinity from watch history |
| Quality | Bayesian public rating (vote count matters; IMDb when the API is up) |
| Runtime | How close the film is to the lengths you actually finish |
| Watch pattern | Recent genre streaks, plus skipped-genre penalties |

Highly rated titles seed TMDB recommendations and similar films; the ranker then sorts the merged pool and explains why a title scored well.

## Data

Library and settings stay on this PC in Electron’s user data folder (`imdbrain.json`). The TMDB key never leaves the machine except to call TMDB. The ratings API keeps `title.ratings.tsv.gz` under `apps/api/data/` and serves lookups only on localhost.
