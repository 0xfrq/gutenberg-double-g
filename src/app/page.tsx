"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent as ReactFormEvent } from "react";
import BookCard, { BookCardData } from "@/components/book-card";
import UploadPanel from "@/components/upload-panel";

type LibraryResponse = {
  cached: BookCardData[];
  uploads: { id: string; title: string }[];
};

type FavoritesResponse = {
  items: BookCardData[];
};

type ShelfResponse = {
  items: BookCardData[];
};

type RecommendationResponse = {
  seed: string;
  results: BookCardData[];
};

type GutenbergResponse = {
  results?: BookCardData[];
};

type CollectionsResponse = {
  collections: { id: string; name: string; count: number }[];
};

type CollectionItemsResponse = {
  items: BookCardData[];
};

type UploadsResponse = {
  uploads: { id: string; title: string }[];
};

const shelfTabs = [
  { value: "to-read", label: "To Read" },
  { value: "reading", label: "Reading" },
  { value: "finished", label: "Finished" },
];

type MainTab = "discover" | "library" | "collections";

function SectionHeader({
  title,
  subtitle,
  count,
}: {
  title: string;
  subtitle?: string;
  count?: number;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-[#d8cbbb] pb-3">
      <h2 className="font-serif text-xl font-normal text-[#241c16]">{title}</h2>
      {count !== undefined && (
        <span className="text-xs tabular-nums text-[#8a7766]">{count}</span>
      )}
      {subtitle && (
        <span className="ml-auto text-[10px] uppercase tracking-[0.18em] text-[#8a7766]">
          {subtitle}
        </span>
      )}
    </div>
  );
}

function EmptyState({
  message,
  action,
  onAction,
}: {
  message: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="col-span-full flex flex-col items-center gap-3 border border-dashed border-[#d8cbbb] px-6 py-10 text-center">
      <p className="max-w-sm text-sm text-[#8a7766]">{message}</p>
      {action && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="border-b border-[#9b3d22] pb-0.5 text-xs font-semibold text-[#9b3d22] transition-colors hover:border-[#6f2818] hover:text-[#6f2818] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#9b3d22]"
        >
          {action}
        </button>
      )}
    </div>
  );
}

function BookGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2">{children}</div>
  );
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [draftQuery, setDraftQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [libraryBooks, setLibraryBooks] = useState<BookCardData[]>([]);
  const [gutenbergBooks, setGutenbergBooks] = useState<BookCardData[]>([]);
  const [favorites, setFavorites] = useState<BookCardData[]>([]);
  const [recommended, setRecommended] = useState<BookCardData[]>([]);
  const [shelf, setShelf] = useState<BookCardData[]>([]);
  const [uploads, setUploads] = useState<BookCardData[]>([]);
  const [collections, setCollections] = useState<
    { id: string; name: string; count: number }[]
  >([]);
  const [collectionItems, setCollectionItems] = useState<BookCardData[]>([]);
  const [activeShelf, setActiveShelf] = useState("reading");
  const [activeCollectionId, setActiveCollectionId] = useState("");
  const [newCollectionName, setNewCollectionName] = useState("");
  const [activeTab, setActiveTab] = useState<MainTab>("discover");
  const searchRef = useRef<HTMLInputElement>(null);

  const isSearching = query.trim().length > 0;

  const resolveSource = useCallback((book: BookCardData) => {
    if (book.source === "upload" || book.source === "gutenberg") return book.source;
    return book.authors_text === "You" ? "upload" : "gutenberg";
  }, []);

  const fetchJson = useCallback(async <T,>(url: string, init?: RequestInit) => {
    const response = await fetch(url, init);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Request failed");
    return data as T;
  }, []);

  const loadCollections = useCallback(async () => {
    const data = await fetchJson<CollectionsResponse>("/api/library/collections");
    setCollections(data.collections || []);
    if (!activeCollectionId && data.collections?.length) {
      setActiveCollectionId(data.collections[0].id);
    }
  }, [activeCollectionId, fetchJson]);

  const loadCollectionItems = useCallback(async (collectionId: string) => {
    if (!collectionId) { setCollectionItems([]); return; }
    const data = await fetchJson<CollectionItemsResponse>(
      `/api/library/collections?collectionId=${encodeURIComponent(collectionId)}`
    );
    setCollectionItems(data.items || []);
  }, [fetchJson]);

  const loadFavorites = useCallback(async () => {
    const data = await fetchJson<FavoritesResponse>("/api/library/favorites");
    setFavorites(data.items || []);
  }, [fetchJson]);

  const loadShelf = useCallback(async () => {
    const data = await fetchJson<ShelfResponse>(
      `/api/library/shelves?shelf=${encodeURIComponent(activeShelf)}`
    );
    setShelf(data.items || []);
  }, [activeShelf, fetchJson]);

  const loadRecommended = useCallback(async () => {
    const data = await fetchJson<RecommendationResponse>("/api/library/recommendations");
    setRecommended(data.results || []);
  }, [fetchJson]);

  const loadUploads = useCallback(async () => {
    const data = await fetchJson<UploadsResponse>("/api/uploads");
    const uploadCards = (data.uploads || []).map((upload) => ({
      id: upload.id,
      title: upload.title,
      summary: "Personal upload",
      authors_text: "You",
    }));
    setUploads(uploadCards);
  }, [fetchJson]);

  const runSearch = useCallback(async (value: string) => {
    setLoading(true);
    try {
      const encoded = encodeURIComponent(value);
      const [libraryData, gutenbergData] = await Promise.all([
        fetchJson<LibraryResponse>(`/api/library/books?q=${encoded}`),
        fetchJson<GutenbergResponse>(`/api/gutenberg/books${value ? `?search=${encoded}` : ""}`),
      ]);
      setLibraryBooks(libraryData.cached || []);
      const uploadCards = (libraryData.uploads || []).map((upload) => ({
        id: upload.id,
        title: upload.title,
        summary: "Personal upload",
        authors_text: "You",
      }));
      setUploads(uploadCards);
      const remoteResults = Array.isArray(gutenbergData?.results) ? gutenbergData.results : [];
      setGutenbergBooks(remoteResults);
    } finally {
      setLoading(false);
    }
  }, [fetchJson]);

  const refreshPanels = useCallback(async () => {
    await Promise.all([loadFavorites(), loadShelf(), loadCollections(), loadUploads()]);
    if (activeCollectionId) await loadCollectionItems(activeCollectionId);
  }, [activeCollectionId, loadCollectionItems, loadCollections, loadFavorites, loadShelf, loadUploads]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void runSearch("");
      void loadRecommended();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [runSearch, loadRecommended]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshPanels();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshPanels]);

  const handleSearchSubmit = async (event: ReactFormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = draftQuery.trim();
    setQuery(trimmed);
    await runSearch(trimmed);
  };

  const handleClearSearch = async () => {
    setDraftQuery("");
    setQuery("");
    await runSearch("");
  };

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return;
    const response = await fetchJson<{ collection: { id: string } }>(
      "/api/library/collections",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCollectionName.trim() }),
      }
    );
    setNewCollectionName("");
    if (response?.collection?.id) setActiveCollectionId(response.collection.id);
    await loadCollections();
  };

  const mainTabs: { value: MainTab; label: string }[] = [
    { value: "discover", label: "Discover" },
    { value: "library", label: "My Library" },
    { value: "collections", label: "Collections" },
  ];

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="border-b border-border bg-paper">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-7 px-6 py-9 md:py-11">
          <div className="flex items-end justify-between gap-6">
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-muted">
                Your private Gutenberg shelf
              </p>
              <h1 className="font-serif text-4xl font-normal tracking-tight text-ink md:text-5xl">
                DoubleG Reader
              </h1>
            </div>
            <span className="hidden pb-1 text-xs text-muted sm:block">Read well. Keep it close.</span>
          </div>

          <form onSubmit={handleSearchSubmit} className="flex w-full gap-3 border-b border-ink/35 pb-3">
            <input
              ref={searchRef}
              value={draftQuery}
              onChange={(e) => setDraftQuery(e.target.value)}
              placeholder="Search title, author, or subject"
              className="min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-muted focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="text-xs text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
              >
                Clear
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="shrink-0 text-xs font-semibold text-primary transition-colors hover:text-primary-hover disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
            >
              {loading ? "Searching…" : "Search ↗"}
            </button>
          </form>

          {!isSearching && (
            <nav className="flex flex-wrap gap-6" aria-label="Library sections">
              {mainTabs.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setActiveTab(tab.value)}
                  className={`border-b-2 pb-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary ${
                    activeTab === tab.value
                      ? "border-primary font-semibold text-ink"
                      : "border-transparent text-muted hover:border-border hover:text-ink"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 pb-24">
        {/* ── SEARCH RESULTS MODE ──────────────────────────────────────────── */}
        {isSearching ? (
          <div className="flex flex-col gap-10">
            <div className="flex items-center gap-3">
              <h2 className="font-serif text-2xl font-normal text-ink">
                Results for &ldquo;{query}&rdquo;
              </h2>
              <span className="text-sm text-muted">
                {gutenbergBooks.length + libraryBooks.length + uploads.length} found
              </span>
            </div>

            {/* From your library */}
            {(libraryBooks.length > 0 || uploads.length > 0) && (
              <div className="flex flex-col gap-4">
                <SectionHeader
                  title="From your library"
                  subtitle="Cached + uploads"
                  count={libraryBooks.length + uploads.length}
                />
                <BookGrid>
                  {libraryBooks.map((book) => (
                    <BookCard key={book.id} book={book} source="gutenberg"
                      activeCollectionId={activeCollectionId} onRefresh={refreshPanels} />
                  ))}
                  {uploads.map((upload) => (
                    <BookCard key={upload.id} book={upload} source="upload"
                      activeCollectionId={activeCollectionId} onRefresh={refreshPanels} />
                  ))}
                </BookGrid>
              </div>
            )}

            {/* Gutenberg results */}
            <div className="flex flex-col gap-4">
              <SectionHeader
                title="Gutenberg"
                subtitle="Project Gutenberg"
                count={gutenbergBooks.length}
              />
              <BookGrid>
                {gutenbergBooks.length > 0
                  ? gutenbergBooks.map((book) => (
                      <BookCard key={book.id} book={book} source="gutenberg"
                        activeCollectionId={activeCollectionId} onRefresh={refreshPanels} />
                    ))
                  : <EmptyState
                      message="No Gutenberg results found."
                      action="Browse popular titles"
                      onAction={() => {
                        setQuery("");
                        setDraftQuery("");
                        setActiveTab("discover");
                      }}
                    />
                }
              </BookGrid>
            </div>
          </div>

        ) : activeTab === "discover" ? (
          /* ── DISCOVER TAB ──────────────────────────────────────────────── */
          <div className="flex flex-col gap-10">
            {/* Recommended */}
            <div className="flex flex-col gap-4">
              <SectionHeader title="Recommended" subtitle="Based on favorites" count={recommended.length} />
              <BookGrid>
                {recommended.length > 0
                  ? recommended.map((book) => (
                      <BookCard key={book.id} book={book} source="gutenberg"
                        activeCollectionId={activeCollectionId} onRefresh={refreshPanels} />
                    ))
                  : <EmptyState
                      message="Favorite a book and recommendations will appear here."
                      action="Browse Gutenberg"
                      onAction={() => searchRef.current?.focus()}
                    />
                }
              </BookGrid>
            </div>

            {/* Browse Gutenberg */}
            <div className="flex flex-col gap-4">
              <SectionHeader title="Browse Gutenberg" subtitle="Popular titles" count={gutenbergBooks.length} />
              <BookGrid>
                {gutenbergBooks.map((book) => (
                  <BookCard key={book.id} book={book} source="gutenberg"
                    activeCollectionId={activeCollectionId} onRefresh={refreshPanels} />
                ))}
              </BookGrid>
            </div>
          </div>

        ) : activeTab === "library" ? (
          /* ── MY LIBRARY TAB ────────────────────────────────────────────── */
          <div className="grid gap-10 lg:grid-cols-[260px_1fr]">
            {/* Sidebar: shelf tabs + upload */}
            <aside className="flex flex-col gap-6">
              <div className="border-l-2 border-primary bg-surface-muted/60 p-4">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                  Shelf
                </p>
                <div className="flex flex-col gap-1">
                  {shelfTabs.map((tab) => (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => setActiveShelf(tab.value)}
                      className={`rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
                        activeShelf === tab.value
                          ? "bg-primary text-primary-foreground"
                          : "text-ink/80 hover:bg-surface-muted"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
              <UploadPanel onUploaded={refreshPanels} />
            </aside>

            <div className="flex flex-col gap-10">
              {/* Current shelf */}
              <div className="flex flex-col gap-4">
                <SectionHeader
                  title={shelfTabs.find((t) => t.value === activeShelf)?.label ?? "Shelf"}
                  subtitle={activeShelf}
                  count={shelf.length}
                />
                <BookGrid>
                  {shelf.length > 0
                    ? shelf.map((book) => (
                        <BookCard key={book.id} book={book} source={resolveSource(book)}
                          activeCollectionId={activeCollectionId} onRefresh={refreshPanels} />
                      ))
                    : <EmptyState
                        message="Nothing on this shelf yet."
                        action="Search Gutenberg"
                        onAction={() => searchRef.current?.focus()}
                      />
                  }
                </BookGrid>
              </div>

              {/* Favorites */}
              <div className="flex flex-col gap-4">
                <SectionHeader title="Favorites" subtitle="Saved highlights" count={favorites.length} />
                <BookGrid>
                  {favorites.length > 0
                    ? favorites.map((book) => (
                        <BookCard key={book.id} book={book} source={resolveSource(book)}
                          activeCollectionId={activeCollectionId} onRefresh={refreshPanels} />
                      ))
                    : <EmptyState message="Add favorites to shape recommendations." />
                  }
                </BookGrid>
              </div>

              {/* Cached + uploads */}
              {(libraryBooks.length > 0 || uploads.length > 0) && (
                <div className="flex flex-col gap-4">
                  <SectionHeader
                    title="Cached books"
                    subtitle="Downloaded"
                    count={libraryBooks.length + uploads.length}
                  />
                  <BookGrid>
                    {libraryBooks.map((book) => (
                      <BookCard key={book.id} book={book} source="gutenberg"
                        activeCollectionId={activeCollectionId} onRefresh={refreshPanels} />
                    ))}
                    {uploads.map((upload) => (
                      <BookCard key={upload.id} book={upload} source="upload"
                        activeCollectionId={activeCollectionId} onRefresh={refreshPanels} />
                    ))}
                  </BookGrid>
                </div>
              )}
            </div>
          </div>

        ) : (
          /* ── COLLECTIONS TAB ───────────────────────────────────────────── */
          <div className="grid gap-10 lg:grid-cols-[260px_1fr]">
            <aside className="flex flex-col gap-4">
              <div className="border-l-2 border-primary bg-surface-muted/60 p-4">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                  Collections
                </p>
                <div className="flex flex-col gap-1">
                  {collections.map((col) => (
                    <button
                      key={col.id}
                      type="button"
                      onClick={() => setActiveCollectionId(col.id)}
                      className={`flex items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                        activeCollectionId === col.id
                          ? "bg-primary text-primary-foreground"
                          : "text-ink/80 hover:bg-surface-muted"
                      }`}
                    >
                      <span className="font-medium">{col.name}</span>
                      <span className={`text-xs tabular-nums ${activeCollectionId === col.id ? "text-primary-foreground/70" : "text-muted"}`}>
                        {col.count}
                      </span>
                    </button>
                  ))}
                  {collections.length === 0 && (
                    <p className="py-2 text-xs text-muted">No collections yet.</p>
                  )}
                </div>

                {/* Create new collection */}
                <div className="mt-4 flex gap-2 border-t border-border pt-4">
                  <input
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleCreateCollection(); }}
                    placeholder="New collection…"
                    className="min-w-0 flex-1 border-b border-border bg-transparent px-1 py-2 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCreateCollection}
                    className="shrink-0 bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    Add
                  </button>
                </div>
              </div>
            </aside>

            <div className="flex flex-col gap-4">
              {activeCollectionId ? (
                <>
                  <SectionHeader
                    title={collections.find((c) => c.id === activeCollectionId)?.name ?? "Collection"}
                    count={collectionItems.length}
                  />
                  <BookGrid>
                    {collectionItems.length > 0
                      ? collectionItems.map((book) => (
                          <BookCard key={book.id} book={book} source={resolveSource(book)}
                            activeCollectionId={activeCollectionId} onRefresh={refreshPanels} />
                        ))
                      : <EmptyState message="Add books to this collection to see them here." />
                    }
                  </BookGrid>
                </>
              ) : (
                <EmptyState message="Select or create a collection on the left." />
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}