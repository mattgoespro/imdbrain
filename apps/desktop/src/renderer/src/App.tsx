import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
  type ReactNode,
} from "react";
import type {
  AppView,
  DiscoverFilters,
  Genre,
  LibraryEntry,
  MovieDetails,
  MovieSummary,
  Settings,
  TasteProfile,
} from "../../shared/types";
import { isAppearanceOnlyPatch } from "../../shared/appearance";
import {
  defaultFilters,
  defaultSettings,
  mediaTypeOf,
  titleKey,
} from "../../shared/types";
import { applySearchHistory } from "../../shared/search-history";
import { applyAppearance } from "./lib/appearance";
import { listSearchHistory } from "./lib/search-history-store";
import Discover from "./views/Discover";
import ForYou from "./views/ForYou";
import Library from "./views/Library";
import SettingsView from "./views/Settings";
import Inspector from "./components/inspector";
import {
  IconForYou,
  IconLibrary,
  IconSearch,
  IconSettings,
} from "./components/icons";
import { cn } from "./lib/cn";
import { btn } from "./lib/ui";

export default function App(): JSX.Element {
  const [view, setView] = useState<AppView>("discover");
  const [settings, setSettings] = useState<Settings>(defaultSettings());
  const [configured, setConfigured] = useState(false);
  const [movieGenres, setMovieGenres] = useState<Genre[]>([]);
  const [tvGenres, setTvGenres] = useState<Genre[]>([]);
  const [library, setLibrary] = useState<LibraryEntry[]>([]);
  const [profile, setProfile] = useState<TasteProfile | null>(null);
  const [filters, setFilters] = useState<DiscoverFilters>(() => {
    const defaults = defaultFilters();
    const latestSearch = listSearchHistory()[0];
    return latestSearch ? applySearchHistory(defaults, latestSearch) : defaults;
  });
  const [selected, setSelected] = useState<MovieSummary | null>(null);
  const [details, setDetails] = useState<MovieDetails | null>(null);
  const [error, setError] = useState("");
  const [booting, setBooting] = useState(true);
  const detailsCache = useRef(new Map<string, MovieDetails>());

  const genres =
    mediaTypeOf(filters.titleKind) === "tv" ? tvGenres : movieGenres;
  const genreMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const genre of movieGenres) map.set(genre.id, genre.name);
    for (const genre of tvGenres) {
      if (!map.has(genre.id)) map.set(genre.id, genre.name);
    }
    return map;
  }, [movieGenres, tvGenres]);

  const refresh = useCallback(async () => {
    const [nextSettings, nextLibrary, isConfigured] = await Promise.all([
      window.api.getSettings(),
      window.api.listLibrary(),
      window.api.configured(),
    ]);
    setSettings(nextSettings);
    setLibrary(nextLibrary);
    setConfigured(isConfigured);
    if (isConfigured) {
      const [nextMovieGenres, nextTvGenres, nextProfile] = await Promise.all([
        window.api.genres("movie").catch(() => [] as Genre[]),
        window.api.genres("tv").catch(() => [] as Genre[]),
        window.api.profile().catch(() => null),
      ]);
      setMovieGenres(nextMovieGenres);
      setTvGenres(nextTvGenres);
      setProfile(nextProfile);
    }
  }, []);

  useEffect(() => {
    refresh()
      .catch((err: Error) => setError(err.message))
      .finally(() => setBooting(false));
  }, [refresh]);

  useEffect(() => {
    if (booting) return;
    applyAppearance(settings);
  }, [booting, settings]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setSelected(null);
      if (event.ctrlKey && event.key === "1") setView("discover");
      if (event.ctrlKey && event.key === "2") setView("foryou");
      if (event.ctrlKey && event.key === "3") setView("library");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!selected) {
      setDetails(null);
      return;
    }
    const key = titleKey(selected);
    const cached = detailsCache.current.get(key);
    if (cached) {
      setDetails(cached);
      return;
    }
    let cancelled = false;
    window.api
      .movie(selected.tmdbId, selected.mediaType)
      .then((movie) => {
        detailsCache.current.set(key, movie);
        if (!cancelled) setDetails(movie);
      })
      .catch(() => {
        if (!cancelled && detailsCache.current.get(key) == null)
          setDetails(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  async function saveSettings(patch: Partial<Settings>): Promise<void> {
    const next = await window.api.setSettings(patch);
    setSettings(next);
    applyAppearance(next);
    setError("");
    if (isAppearanceOnlyPatch(patch)) return;
    setConfigured(Boolean(next.tmdbApiKey.trim()));
    await refresh();
  }

  async function upsert(
    movie: MovieSummary,
    status: LibraryEntry["status"],
    rating?: number,
  ): Promise<void> {
    const next = await window.api.upsertLibrary({ movie, status, rating });
    setLibrary(next);
    setProfile(await window.api.profile().catch(() => profile));
  }

  const showWelcome = !booting && !configured && view !== "settings";
  const discoverLayout = view === "discover" && configured && !booting;
  const forYouLayout = view === "foryou" && configured && !booting;

  const inspector = (
    <Inspector
      movie={selected}
      details={details}
      entry={library.find(
        (e) => selected && titleKey(e) === titleKey(selected),
      )}
      match={
        "match" in (selected ?? {})
          ? (selected as { match?: number }).match
          : null
      }
      docked={!discoverLayout}
      genreMap={genreMap}
      onUpsert={upsert}
      onRemove={async (id, mediaType) => {
        setLibrary(await window.api.removeLibrary(id, mediaType));
        if (
          selected &&
          titleKey(selected) === titleKey({ tmdbId: id, mediaType })
        )
          setSelected(null);
      }}
    />
  );

  return (
    <div className="grid h-full grid-rows-[36px_1fr]">
      <div className="app-drag flex items-center border-b border-line px-4 text-[11px] tracking-[0.16em] text-muted uppercase">
        <span className="mr-2 text-accent">●</span> IMDBrain
      </div>
      <div
        className={
          selected && view !== "settings" && !discoverLayout
            ? "grid min-h-0 grid-cols-[64px_minmax(0,1fr)_minmax(280px,400px)] max-inspect:grid-cols-[64px_minmax(0,1fr)] max-inspect:grid-rows-[1fr_auto]"
            : "grid min-h-0 grid-cols-[64px_minmax(0,1fr)]"
        }
      >
        <nav
          className="app-no-drag flex flex-col items-center gap-2 border-r border-line bg-transparent px-2 py-4"
          aria-label="Primary"
        >
          <div className="mb-2 grid size-9.5 place-items-center rounded-xl bg-linear-to-b from-accent-2 to-accent text-xs font-bold tracking-[-0.06em] text-accent-ink shadow-accent">
            IB
          </div>
          <NavBtn
            id="discover"
            view={view}
            setView={setView}
            label="Search"
            tip="Search"
          >
            <IconSearch />
          </NavBtn>
          <NavBtn
            id="foryou"
            view={view}
            setView={setView}
            label="For you"
            tip="For you"
          >
            <IconForYou />
          </NavBtn>
          <NavBtn
            id="library"
            view={view}
            setView={setView}
            label="Library"
            tip="Library"
          >
            <IconLibrary />
          </NavBtn>
          <NavBtn
            id="settings"
            view={view}
            setView={setView}
            label="Settings"
            tip="Settings"
          >
            <IconSettings />
          </NavBtn>
        </nav>
        <main
          className={cn(
            "min-h-0 min-w-0",
            discoverLayout && "flex flex-col overflow-hidden p-0",
            forYouLayout && "flex flex-col overflow-hidden px-7 pt-6 pb-4",
            !discoverLayout && !forYouLayout && "overflow-auto px-7 pt-6 pb-10",
          )}
        >
          {error ? (
            <div
              className={cn(
                "mb-3.5 rounded-app border border-(--color-danger-border) bg-(--color-danger-bg) px-3 py-2.5 text-danger-fg",
                (discoverLayout || forYouLayout) && "shrink-0",
                discoverLayout && "mx-4 mt-3 mb-0",
              )}
            >
              {error}
            </div>
          ) : null}
          {booting ? (
            <div className="px-4 py-9 text-center text-muted">
              Loading your ranking studio…
            </div>
          ) : showWelcome ? (
            <section className="mx-auto my-[8vh] max-w-160 px-0 py-2">
              <h2 className="mt-0 mb-2.5 text-[32px] tracking-title">
                Start with a TMDB key.
              </h2>
              <p className="leading-[1.55] text-muted">
                IMDBrain searches the IMDb-linked movie catalog through TMDB,
                then ranks titles against your ratings, skips, and watch
                history. The official IMDb API is not publicly available, so
                this app uses TMDB metadata plus IMDb IDs, IMDb page links, and
                optional IMDb ratings import.
              </p>
              <p className="leading-[1.55] text-muted">
                Create a free key at{" "}
                <a
                  className="text-accent"
                  href="https://www.themoviedb.org/settings/api"
                  target="_blank"
                  rel="noreferrer"
                >
                  themoviedb.org/settings/api
                </a>
                , then paste it in Settings.
              </p>
              <button
                className={btn("primary")}
                onClick={() => setView("settings")}
              >
                Open Settings
              </button>
            </section>
          ) : view === "discover" ? (
            <Discover
              filters={filters}
              setFilters={setFilters}
              genres={genres}
              selectedId={selected ? titleKey(selected) : null}
              onOpen={setSelected}
              onError={setError}
              inspector={inspector}
            />
          ) : view === "foryou" ? (
            <ForYou
              profile={profile}
              genreMap={genreMap}
              selectedId={selected ? titleKey(selected) : null}
              onOpen={setSelected}
              onError={setError}
              rankingMode={settings.rankingMode}
            />
          ) : view === "library" ? (
            <Library
              library={library}
              genreMap={genreMap}
              selectedId={selected ? titleKey(selected) : null}
              onOpen={setSelected}
              onChange={setLibrary}
            />
          ) : (
            <SettingsView
              settings={settings}
              onSave={saveSettings}
              onLibraryChange={setLibrary}
              onError={setError}
            />
          )}
        </main>
        {!discoverLayout &&
        selected &&
        view !== "settings" &&
        !showWelcome &&
        !booting
          ? inspector
          : null}
      </div>
    </div>
  );
}

function NavBtn({
  id,
  view,
  setView,
  label,
  tip,
  children,
}: {
  id: AppView;
  view: AppView;
  setView: (view: AppView) => void;
  label: string;
  tip: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <button
      type="button"
      className={cn(
        "relative grid size-10 place-items-center rounded-xl border-0 p-0 transition-[background,color] duration-140",
        "after:pointer-events-none after:absolute after:top-1/2 after:left-[calc(100%+10px)] after:z-5 after:-translate-y-1/2 after:rounded-lg after:border after:border-line after:bg-raised after:px-2.5 after:py-1.5 after:text-[11px] after:font-semibold after:tracking-normal after:text-ink after:whitespace-nowrap after:shadow-panel after:content-none hover:after:content-[attr(data-tip)] focus-visible:after:content-[attr(data-tip)]",
        view === id
          ? "bg-accent-soft text-accent hover:bg-accent-soft hover:text-accent"
          : "bg-transparent text-muted hover:bg-wash-6 hover:text-ink",
      )}
      aria-label={label}
      data-tip={tip}
      onClick={() => setView(id)}
    >
      {children}
    </button>
  );
}
