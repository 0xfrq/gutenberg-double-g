"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import BookCard, { type BookCardData, type BookSource } from "@/components/book-card";
import BookSheet, { type SheetContext, type SheetTarget } from "@/components/book-sheet";
import { Brand } from "@/components/brand";
import { Icon, type IconName } from "@/components/icons";
import {
  BookGrid,
  ChipRow,
  EmptyState,
  ErrorState,
  FilterChip,
  PageHeader,
  PillButton,
  Rail,
  Section,
  SkeletonGrid,
} from "@/components/library-ui";
import UploadPanel from "@/components/upload-panel";
import { useReadingProgress, type BookProgress } from "@/lib/reading-progress";

type UploadRow = { id: string; title: string };
type LibraryResponse = { cached: BookCardData[]; uploads: UploadRow[] };
type ItemsResponse = { items: BookCardData[] };
type RecommendationResponse = { seed: string; results: BookCardData[] };
type GutenbergResponse = { results?: BookCardData[]; next?: string | null };
type Collection = { id: string; name: string; count: number };
type CollectionsResponse = { collections: Collection[] };
type UploadsResponse = { uploads: UploadRow[] };

type MainTab = "discover" | "library" | "collections" | "uploads";
type LibraryFilter = "reading" | "to-read" | "finished" | "favorites" | "all";

const tabs: { value: MainTab; label: string; icon: IconName }[] = [
  { value: "discover", label: "Discover", icon: "compass" },
  { value: "library", label: "Library", icon: "library" },
  { value: "collections", label: "Collections", icon: "layers" },
  { value: "uploads", label: "Uploads", icon: "upload" },
];

const libraryFilters: { value: LibraryFilter; label: string }[] = [
  { value: "reading", label: "Reading" },
  { value: "to-read", label: "To read" },
  { value: "finished", label: "Finished" },
  { value: "favorites", label: "Favorites" },
  { value: "all", label: "All books" },
];

const shelfEmpty: Record<string, { title: string; body: string }> = {
  reading: {
    title: "Nothing on your Reading shelf",
    body: "Open any book’s menu (···) and tap Reading to keep it close at hand.",
  },
  "to-read": {
    title: "Your To read shelf is empty",
    body: "Save books for later from any book’s menu (···).",
  },
  finished: {
    title: "No finished books yet",
    body: "When you reach the last page, add the book here to remember it.",
  },
};

function toUploadCards(uploads?: UploadRow[]): BookCardData[] {
  return (uploads || []).map((upload) => ({ id: upload.id, title: upload.title, source: "upload" }));
}

function resolveSource(book: BookCardData): BookSource {
  if (book.source === "upload" || book.source === "gutenberg") return book.source;
  return book.authors_text === "You" ? "upload" : "gutenberg";
}

function logError(error: unknown) {
  console.error(error);
}

// The RapidAPI Project Gutenberg catalogue searches titles, authors, and
// subjects with `q`. It silently ignores a `search` parameter and returns the
// popular list instead, which is why searches used to "do nothing".
function gutenbergUrl(query: string, page = 1) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return `/api/gutenberg/books${qs ? `?${qs}` : ""}`;
}

function nextPageFrom(next?: string | null) {
  if (!next) return null;
  try {
    const page = Number(new URL(next).searchParams.get("page"));
    return Number.isInteger(page) && page > 1 ? page : null;
  } catch {
    return null;
  }
}

export default function Home() {
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");
  const [browseState, setBrowseState] = useState<"loading" | "ready" | "error">("loading");
  const [libraryBooks, setLibraryBooks] = useState<BookCardData[]>([]);
  const [matchedUploads, setMatchedUploads] = useState<BookCardData[]>([]);
  const [gutenbergBooks, setGutenbergBooks] = useState<BookCardData[]>([]);
  const [gutenbergNextPage, setGutenbergNextPage] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);
  const [favorites, setFavorites] = useState<BookCardData[]>([]);
  const [recommended, setRecommended] = useState<BookCardData[]>([]);
  const [seed, setSeed] = useState("");
  const [shelf, setShelf] = useState<BookCardData[]>([]);
  const [shelfFor, setShelfFor] = useState<string | null>(null);
  const [uploads, setUploads] = useState<BookCardData[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionItems, setCollectionItems] = useState<BookCardData[]>([]);
  const [itemsFor, setItemsFor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState({ favorites: false, uploads: false, collections: false });
  const [activeTab, setActiveTab] = useState<MainTab>("discover");
  const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>("reading");
  const [activeShelf, setActiveShelf] = useState("reading");
  const [activeCollectionId, setActiveCollectionId] = useState("");
  const [newCollectionName, setNewCollectionName] = useState("");
  const [creatingCollection, setCreatingCollection] = useState(false);
  const [collectionError, setCollectionError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetTarget | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const searchSeq = useRef(0);
  const shelfRequest = useRef("");
  const collectionRequest = useRef("");
  const progress = useReadingProgress();

  const isSearching = query.length > 0;

  // ── Data ──────────────────────────────────────────────────────────────────

  const fetchJson = useCallback(async <T,>(url: string, init?: RequestInit) => {
    const response = await fetch(url, init);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error((data as { error?: string }).error || "Request failed");
    return data as T;
  }, []);

  const loadLibrary = useCallback(
    async (value: string) => {
      const data = await fetchJson<LibraryResponse>(`/api/library/books?q=${encodeURIComponent(value)}`);
      setLibraryBooks(data.cached || []);
      setMatchedUploads(toUploadCards(data.uploads));
    },
    [fetchJson]
  );

  const runSearch = useCallback(
    async (value: string) => {
      const seq = ++searchSeq.current;
      setBrowseState("loading");
      // Drop the previous list so old books never pose as results for the new query.
      setGutenbergBooks([]);
      setGutenbergNextPage(null);
      setLoadingMore(false);
      setLoadMoreFailed(false);
      const [library, gutenberg] = await Promise.allSettled([
        fetchJson<LibraryResponse>(`/api/library/books?q=${encodeURIComponent(value)}`),
        fetchJson<GutenbergResponse>(gutenbergUrl(value)),
      ]);
      if (seq !== searchSeq.current) return; // a newer search already answered
      if (library.status === "fulfilled") {
        setLibraryBooks(library.value.cached || []);
        setMatchedUploads(toUploadCards(library.value.uploads));
      } else {
        logError(library.reason);
      }
      if (gutenberg.status === "fulfilled") {
        const results = gutenberg.value?.results;
        setGutenbergBooks(Array.isArray(results) ? results : []);
        setGutenbergNextPage(nextPageFrom(gutenberg.value?.next));
        setBrowseState("ready");
      } else {
        logError(gutenberg.reason);
        setBrowseState("error");
      }
    },
    [fetchJson]
  );

  const loadRecommended = useCallback(async () => {
    const data = await fetchJson<RecommendationResponse>("/api/library/recommendations");
    setRecommended(data.results || []);
    setSeed(data.seed || "");
  }, [fetchJson]);

  const loadFavorites = useCallback(async () => {
    const data = await fetchJson<ItemsResponse>("/api/library/favorites");
    setFavorites(data.items || []);
    setLoaded((current) => ({ ...current, favorites: true }));
  }, [fetchJson]);

  const loadUploads = useCallback(async () => {
    const data = await fetchJson<UploadsResponse>("/api/uploads");
    setUploads(toUploadCards(data.uploads));
    setLoaded((current) => ({ ...current, uploads: true }));
  }, [fetchJson]);

  const loadCollections = useCallback(async () => {
    const data = await fetchJson<CollectionsResponse>("/api/library/collections");
    const list = data.collections || [];
    setCollections(list);
    setActiveCollectionId((current) =>
      current && list.some((collection) => collection.id === current) ? current : list[0]?.id || ""
    );
    setLoaded((current) => ({ ...current, collections: true }));
  }, [fetchJson]);

  const loadShelf = useCallback(
    async (value: string) => {
      shelfRequest.current = value;
      const data = await fetchJson<ItemsResponse>(`/api/library/shelves?shelf=${encodeURIComponent(value)}`);
      if (shelfRequest.current !== value) return;
      setShelf(data.items || []);
      setShelfFor(value);
    },
    [fetchJson]
  );

  const loadCollectionItems = useCallback(
    async (collectionId: string) => {
      collectionRequest.current = collectionId;
      if (!collectionId) {
        setCollectionItems([]);
        setItemsFor("");
        return;
      }
      const data = await fetchJson<ItemsResponse>(
        `/api/library/collections?collectionId=${encodeURIComponent(collectionId)}`
      );
      if (collectionRequest.current !== collectionId) return;
      setCollectionItems(data.items || []);
      setItemsFor(collectionId);
    },
    [fetchJson]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void runSearch("");
      void loadRecommended().catch(logError);
      void loadFavorites().catch(logError);
      void loadUploads().catch(logError);
      void loadCollections().catch(logError);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [runSearch, loadRecommended, loadFavorites, loadUploads, loadCollections]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadShelf(activeShelf).catch(logError), 0);
    return () => window.clearTimeout(timer);
  }, [activeShelf, loadShelf]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadCollectionItems(activeCollectionId).catch(logError), 0);
    return () => window.clearTimeout(timer);
  }, [activeCollectionId, loadCollectionItems]);

  const refreshAll = useCallback(async () => {
    const results = await Promise.allSettled([
      loadLibrary(query),
      loadFavorites(),
      loadShelf(activeShelf),
      loadUploads(),
      loadCollections(),
      loadCollectionItems(activeCollectionId),
    ]);
    results.forEach((result) => {
      if (result.status === "rejected") logError(result.reason);
    });
  }, [
    activeCollectionId,
    activeShelf,
    loadCollectionItems,
    loadCollections,
    loadFavorites,
    loadLibrary,
    loadShelf,
    loadUploads,
    query,
  ]);

  // "/" jumps to search, like most reading and docs apps.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = draftQuery.trim();
    if (!trimmed && !query) return;
    setQuery(trimmed);
    void runSearch(trimmed);
    searchRef.current?.blur();
  };

  const clearSearch = () => {
    setDraftQuery("");
    if (!query) return;
    setQuery("");
    void runSearch("");
  };

  const goToTab = (tab: MainTab) => {
    clearSearch();
    setActiveTab(tab);
    window.scrollTo({ top: 0 });
  };

  const chooseLibraryFilter = (filter: LibraryFilter) => {
    setLibraryFilter(filter);
    if (filter === "reading" || filter === "to-read" || filter === "finished") setActiveShelf(filter);
  };

  const handleCreateCollection = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = newCollectionName.trim();
    if (!name) return;
    setCreatingCollection(true);
    setCollectionError(null);
    try {
      const response = await fetchJson<{ collection: { id: string } }>("/api/library/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setNewCollectionName("");
      if (response?.collection?.id) setActiveCollectionId(response.collection.id);
      await loadCollections();
    } catch {
      setCollectionError("That collection wasn’t created. Check your connection and try again.");
    } finally {
      setCreatingCollection(false);
    }
  };

  const loadMoreGutenberg = async () => {
    if (!gutenbergNextPage || loadingMore) return;
    const seq = searchSeq.current;
    setLoadingMore(true);
    setLoadMoreFailed(false);
    try {
      const data = await fetchJson<GutenbergResponse>(gutenbergUrl(query, gutenbergNextPage));
      if (seq !== searchSeq.current) return;
      const more = Array.isArray(data.results) ? data.results : [];
      setGutenbergBooks((current) => {
        const seen = new Set(current.map((book) => String(book.id)));
        return [...current, ...more.filter((book) => !seen.has(String(book.id)))];
      });
      setGutenbergNextPage(nextPageFrom(data.next));
    } catch (error) {
      logError(error);
      if (seq === searchSeq.current) setLoadMoreFailed(true);
    } finally {
      if (seq === searchSeq.current) setLoadingMore(false);
    }
  };

  const openSheet = (book: BookCardData, source: BookSource, context?: SheetContext) =>
    setSheet({ book, source, context });

  // ── Derived ───────────────────────────────────────────────────────────────

  const favoriteKeys = useMemo(
    () => new Set(favorites.map((book) => `${resolveSource(book)}:${book.id}`)),
    [favorites]
  );

  const continueReading = useMemo(() => {
    const items: { book: BookCardData; source: BookSource; progress: BookProgress }[] = [];
    const seen = new Set<string>();
    const add = (book: BookCardData, source: BookSource) => {
      const saved = progress.get(String(book.id));
      if (!saved || seen.has(String(book.id))) return;
      seen.add(String(book.id));
      items.push({ book, source, progress: saved });
    };
    libraryBooks.forEach((book) => add(book, "gutenberg"));
    uploads.forEach((book) => add(book, "upload"));
    return items.sort((a, b) => (b.progress.updatedAt ?? 0) - (a.progress.updatedAt ?? 0)).slice(0, 9);
  }, [libraryBooks, uploads, progress]);

  const renderCard = (book: BookCardData, source: BookSource, context?: SheetContext) => (
    <BookCard
      key={`${source}:${book.id}`}
      book={book}
      source={source}
      progress={progress.get(String(book.id))}
      onMore={() => openSheet(book, source, context)}
    />
  );

  const libraryCount = libraryBooks.length + uploads.length;

  // ── Views ─────────────────────────────────────────────────────────────────

  const focusSearch = () => searchRef.current?.focus();

  const gutenbergResults = (mode: "search" | "browse") => {
    if (browseState === "error") {
      return (
        <ErrorState
          title="Couldn’t reach Project Gutenberg"
          body="Check your connection, then try again."
          onRetry={() => void runSearch(query)}
        />
      );
    }
    if (browseState === "loading" && gutenbergBooks.length === 0) return <SkeletonGrid />;
    if (gutenbergBooks.length === 0) {
      return (
        <EmptyState
          title="No matches on Project Gutenberg"
          body="Try an author’s last name, a shorter title, or a subject like “poetry”."
          action={mode === "search" ? "Clear search" : "Search the catalogue"}
          onAction={mode === "search" ? clearSearch : focusSearch}
        />
      );
    }
    return (
      <>
        <BookGrid>{gutenbergBooks.map((book) => renderCard(book, "gutenberg"))}</BookGrid>
        {gutenbergNextPage ? (
          <div className="mt-10 flex flex-col items-center gap-3">
            <PillButton variant="outline" onClick={() => void loadMoreGutenberg()} disabled={loadingMore}>
              {loadingMore ? "Loading more…" : "Show more books"}
            </PillButton>
            {loadMoreFailed ? (
              <p role="alert" className="text-sm font-medium text-danger">
                The next page didn’t load. Check your connection and try again.
              </p>
            ) : null}
          </div>
        ) : null}
      </>
    );
  };

  const searchCount = gutenbergBooks.length + libraryBooks.length + matchedUploads.length;

  const searchView = (
    <>
      <PageHeader
        title={`Results for “${query}”`}
        description={
          browseState === "loading"
            ? "Searching Project Gutenberg…"
            : `${searchCount}${gutenbergNextPage ? "+" : ""} ${searchCount === 1 ? "book" : "books"} found`
        }
        action={
          <PillButton variant="outline" onClick={clearSearch}>
            Clear search
          </PillButton>
        }
      />
      <div className="flex flex-col gap-12">
        {libraryBooks.length + matchedUploads.length > 0 ? (
          <Section title="In your library" count={libraryBooks.length + matchedUploads.length}>
            <BookGrid>
              {libraryBooks.map((book) => renderCard(book, "gutenberg"))}
              {matchedUploads.map((book) => renderCard(book, "upload"))}
            </BookGrid>
          </Section>
        ) : null}
        <Section title="On Project Gutenberg">{gutenbergResults("search")}</Section>
      </div>
    </>
  );

  const discoverView = (
    <>
      <PageHeader
        title="Discover"
        description="Free classics from Project Gutenberg. Open one, and Dogear keeps your page."
      />
      <div className="flex flex-col gap-12 md:gap-14">
        {continueReading.length > 0 ? (
          <Section title="Continue reading" description="Right where you folded the corner.">
            <Rail wide>
              {continueReading.map(({ book, source, progress: saved }) => (
                <BookCard
                  key={`${source}:${book.id}`}
                  book={book}
                  source={source}
                  progress={saved}
                  variant="continue"
                  onMore={() => openSheet(book, source)}
                />
              ))}
            </Rail>
          </Section>
        ) : null}

        {seed && recommended.length > 0 ? (
          <Section
            title="More like your favorites"
            description={`Because you saved books on ${seed.replace(/\s*--\s*/g, " · ")}`}
          >
            <Rail>{recommended.slice(0, 12).map((book) => renderCard(book, "gutenberg"))}</Rail>
          </Section>
        ) : null}

        <Section title="Popular on Gutenberg" description="Free to read. Tap a cover to start.">
          {gutenbergResults("browse")}
        </Section>
      </div>
    </>
  );

  const libraryContent = () => {
    if (libraryFilter === "favorites") {
      if (!loaded.favorites) return <SkeletonGrid count={6} />;
      if (favorites.length === 0) {
        return (
          <EmptyState
            title="No favorites yet"
            body="Tap the heart in any book’s menu (···). Favorites also shape your recommendations."
            action="Find a book"
            onAction={() => goToTab("discover")}
          />
        );
      }
      return <BookGrid>{favorites.map((book) => renderCard(book, resolveSource(book)))}</BookGrid>;
    }

    if (libraryFilter === "all") {
      if (libraryCount === 0) {
        return (
          <EmptyState
            title="Your library is empty"
            body="Books you open, save, or upload will gather here."
            action="Find a book"
            onAction={() => goToTab("discover")}
          />
        );
      }
      return (
        <BookGrid>
          {libraryBooks.map((book) => renderCard(book, "gutenberg"))}
          {uploads.map((book) => renderCard(book, "upload"))}
        </BookGrid>
      );
    }

    if (shelfFor !== activeShelf) return <SkeletonGrid count={6} />;
    if (shelf.length === 0) {
      const empty = shelfEmpty[activeShelf];
      return (
        <EmptyState title={empty.title} body={empty.body} action="Find a book" onAction={() => goToTab("discover")} />
      );
    }
    const label = libraryFilters.find((filter) => filter.value === activeShelf)?.label ?? "this shelf";
    return (
      <BookGrid>
        {shelf.map((book) => renderCard(book, resolveSource(book), { kind: "shelf", shelf: activeShelf, label }))}
      </BookGrid>
    );
  };

  const libraryView = (
    <>
      <PageHeader title="Your library" description="Shelves, favorites, and every book you’ve opened." />
      <ChipRow label="Filter your library">
        {libraryFilters.map((filter) => (
          <FilterChip
            key={filter.value}
            label={filter.label}
            active={libraryFilter === filter.value}
            count={
              filter.value === "favorites" && loaded.favorites
                ? favorites.length
                : filter.value === "all"
                  ? libraryCount
                  : undefined
            }
            onClick={() => chooseLibraryFilter(filter.value)}
          />
        ))}
      </ChipRow>
      <div className="mt-7">{libraryContent()}</div>
    </>
  );

  const activeCollection = collections.find((collection) => collection.id === activeCollectionId);

  const collectionsView = (
    <>
      <PageHeader
        title="Collections"
        description="Group books however you like — a course, a season, a mood."
      />
      <form onSubmit={handleCreateCollection} className="flex max-w-md gap-2">
        <label htmlFor="new-collection" className="sr-only">
          Collection name
        </label>
        <input
          id="new-collection"
          value={newCollectionName}
          onChange={(event) => setNewCollectionName(event.target.value)}
          placeholder="Name a new collection"
          className="h-11 min-w-0 flex-1 rounded-full bg-paper-3 px-4 text-[0.9375rem] text-ink placeholder:text-muted"
        />
        <PillButton type="submit" disabled={!newCollectionName.trim() || creatingCollection}>
          {creatingCollection ? "Creating…" : "Create"}
        </PillButton>
      </form>
      {collectionError ? (
        <p role="alert" className="mt-3 text-sm font-medium text-danger">
          {collectionError}
        </p>
      ) : null}

      <div className="mt-8">
        {collections.length > 0 ? (
          <>
            <ChipRow label="Choose a collection">
              {collections.map((collection) => (
                <FilterChip
                  key={collection.id}
                  label={collection.name}
                  count={collection.count}
                  active={collection.id === activeCollectionId}
                  onClick={() => setActiveCollectionId(collection.id)}
                />
              ))}
            </ChipRow>
            <div className="mt-7">
              {itemsFor !== activeCollectionId ? (
                <SkeletonGrid count={6} />
              ) : collectionItems.length > 0 ? (
                <BookGrid>
                  {collectionItems.map((book) =>
                    renderCard(book, resolveSource(book), {
                      kind: "collection",
                      id: activeCollectionId,
                      name: activeCollection?.name ?? "this collection",
                    })
                  )}
                </BookGrid>
              ) : (
                <EmptyState
                  title={`${activeCollection?.name ?? "This collection"} is empty`}
                  body="Add books from any book’s menu (···) under Collections."
                  action="Find a book"
                  onAction={() => goToTab("discover")}
                />
              )}
            </div>
          </>
        ) : loaded.collections ? (
          <EmptyState
            title="No collections yet"
            body="Name one above, then add books to it from any book’s menu (···)."
          />
        ) : null}
      </div>
    </>
  );

  const uploadsView = (
    <>
      <PageHeader title="Uploads" description="Bring your own EPUB files and read them right here." />
      <div className="max-w-2xl">
        <UploadPanel onUploaded={() => void refreshAll()} />
      </div>
      <Section title="Your files" count={loaded.uploads ? uploads.length : undefined} className="mt-12">
        {!loaded.uploads ? (
          <SkeletonGrid count={6} />
        ) : uploads.length > 0 ? (
          <BookGrid>{uploads.map((book) => renderCard(book, "upload"))}</BookGrid>
        ) : (
          <EmptyState title="No uploads yet" body="Files you add above show up here, ready to read." />
        )}
      </Section>
    </>
  );

  const views: Record<MainTab, ReactNode> = {
    discover: discoverView,
    library: libraryView,
    collections: collectionsView,
    uploads: uploadsView,
  };

  // ── Layout ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-dvh">
      <header
        className="z-[200] border-b border-rule bg-paper md:sticky md:top-0"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6 md:flex-nowrap">
          <button
            type="button"
            onClick={() => goToTab("discover")}
            className="shrink-0 rounded-lg py-1"
            aria-label="Dogear, go to Discover"
          >
            <Brand />
          </button>

          <nav aria-label="Sections" className="hidden items-center gap-1 md:flex">
            {tabs.map((tab) => {
              const active = activeTab === tab.value && !isSearching;
              return (
                <button
                  key={tab.value}
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => goToTab(tab.value)}
                  className={`h-9 whitespace-nowrap rounded-full px-3.5 text-sm font-semibold transition-soft ${
                    active ? "bg-accent-soft text-accent" : "text-muted hover:bg-paper-3 hover:text-ink"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>

          <form role="search" onSubmit={handleSearchSubmit} className="w-full md:ml-auto md:w-72 lg:w-80">
            <div className="relative">
              <Icon
                name="search"
                size={18}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                ref={searchRef}
                type="search"
                enterKeyHint="search"
                value={draftQuery}
                onChange={(event) => setDraftQuery(event.target.value)}
                aria-label="Search books by title, author, or subject"
                placeholder="Title, author, or subject"
                className="h-11 w-full rounded-full border border-transparent bg-paper-3 pl-11 pr-11 text-[0.9375rem] text-ink transition-soft placeholder:text-muted hover:border-rule-2"
              />
              {draftQuery ? (
                <button
                  type="button"
                  onClick={clearSearch}
                  aria-label="Clear search"
                  className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-muted transition-soft hover:bg-rule hover:text-ink"
                >
                  <Icon name="x" size={16} />
                </button>
              ) : (
                <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-rule-2 px-1.5 font-sans text-xs text-muted md:block">
                  /
                </kbd>
              )}
            </div>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-7 sm:px-6 md:pt-11">
        {isSearching ? searchView : views[activeTab]}
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 md:pb-10">
        <p className="border-t border-rule pt-5 text-xs text-muted">
          Dogear · Classic books from Project Gutenberg, free in the public domain.
        </p>
      </footer>

      <nav
        aria-label="Sections"
        className="fixed inset-x-0 bottom-0 z-[200] border-t border-rule bg-paper-2 md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="mx-auto grid max-w-md grid-cols-4">
          {tabs.map((tab) => {
            const active = activeTab === tab.value && !isSearching;
            return (
              <li key={tab.value}>
                <button
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => goToTab(tab.value)}
                  className="flex w-full flex-col items-center gap-1 pb-2.5 pt-2"
                >
                  <span
                    className={`grid h-8 w-14 place-items-center rounded-full transition-soft ${
                      active ? "bg-accent-soft text-accent" : "text-muted"
                    }`}
                  >
                    <Icon name={tab.icon} size={22} />
                  </span>
                  <span
                    className={`whitespace-nowrap text-[0.6875rem] font-semibold ${active ? "text-ink" : "text-muted"}`}
                  >
                    {tab.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {sheet ? (
        <BookSheet
          key={`${sheet.source}:${sheet.book.id}`}
          target={sheet}
          collections={collections}
          isFavorite={favoriteKeys.has(`${sheet.source}:${sheet.book.id}`)}
          progress={progress.get(String(sheet.book.id))}
          onClose={() => setSheet(null)}
          onChanged={() => void refreshAll()}
        />
      ) : null}
    </div>
  );
}
