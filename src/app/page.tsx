"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
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
    <div className="flex items-baseline gap-3 border-b border-amber-200/60 pb-3">
      <h2 className="text-base font-semibold text-amber-950">{title}</h2>
      {count !== undefined && (
        <span className="text-xs tabular-nums text-amber-600">{count}</span>
      )}
      {subtitle && (
        <span className="ml-auto text-xs uppercase tracking-widest text-amber-500">
          {subtitle}
        </span>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="col-span-full py-6 text-center text-sm text-amber-700/60">
      {message}
    </p>
  );
}

function BookGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">{children}</div>
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
        fetchJson<any>(`/api/gutenberg/books${value ? `?search=${encoded}` : ""}`),
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
    runSearch("");
    loadRecommended();
  }, [runSearch, loadRecommended]);

  useEffect(() => { refreshPanels(); }, [refreshPanels]);
  useEffect(() => { loadShelf(); }, [activeShelf, loadShelf]);
  useEffect(() => {
    if (activeCollectionId) loadCollectionItems(activeCollectionId);
  }, [activeCollectionId, loadCollectionItems]);

  const handleSearchSubmit = async (event: FormEvent<HTMLFormElement>) => {
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#f8f1e7_20%,#f4ece1_60%,#efe2d0_100%)] text-amber-950">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-32 top-10 h-72 w-72 rounded-full bg-amber-200/40 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 top-40 h-56 w-56 rounded-full bg-teal-200/40 blur-3xl" />
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-700">
            Your private Gutenberg shelf
          </p>
          <h1 className="text-4xl font-semibold text-amber-950 md:text-5xl">
            DoubleG Reader
          </h1>

          {/* Search */}
          <form
            onSubmit={handleSearchSubmit}
            className="flex w-full max-w-2xl gap-2 rounded-3xl border border-amber-200/70 bg-white/70 p-2 shadow-sm backdrop-blur"
          >
            <input
              value={draftQuery}
              onChange={(e) => setDraftQuery(e.target.value)}
              placeholder="Search by title, author, or subject…"
              className="flex-1 rounded-2xl bg-transparent px-4 py-2.5 text-sm text-amber-900 placeholder:text-amber-400 focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="rounded-2xl px-3 py-2.5 text-xs text-amber-600 hover:text-amber-900 transition"
              >
                Clear
              </button>
            )}
            <button
              type="submit"
              className="rounded-2xl bg-amber-900 px-5 py-2.5 text-sm font-semibold text-amber-50 transition hover:bg-amber-800"
            >
              {loading ? "…" : "Search"}
            </button>
          </form>

          {/* Main tabs — hidden when actively searching */}
          {!isSearching && (
            <div className="flex gap-1">
              {mainTabs.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setActiveTab(tab.value)}
                  className={`rounded-full px-5 py-2 text-sm font-medium transition ${
                    activeTab === tab.value
                      ? "bg-amber-900 text-amber-50 shadow-sm"
                      : "text-amber-800 hover:bg-amber-900/10"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 pb-24">
        {/* ── SEARCH RESULTS MODE ──────────────────────────────────────────── */}
        {isSearching ? (
          <div className="flex flex-col gap-10">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-amber-950">
                Results for &ldquo;{query}&rdquo;
              </h2>
              <span className="text-sm text-amber-600">
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
                  : <EmptyState message="No Gutenberg results found." />
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
                  : <EmptyState message="Favorite some books to get recommendations." />
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
              <div className="rounded-2xl border border-amber-200/60 bg-white/70 p-4 shadow-sm">
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-amber-700">
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
                          ? "bg-amber-900 text-amber-50"
                          : "text-amber-800 hover:bg-amber-100"
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
                    : <EmptyState message="Nothing on this shelf yet." />
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
              <div className="rounded-2xl border border-amber-200/60 bg-white/70 p-4 shadow-sm">
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-amber-700">
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
                          ? "bg-amber-900 text-amber-50"
                          : "text-amber-800 hover:bg-amber-100"
                      }`}
                    >
                      <span className="font-medium">{col.name}</span>
                      <span className={`text-xs tabular-nums ${activeCollectionId === col.id ? "text-amber-200" : "text-amber-500"}`}>
                        {col.count}
                      </span>
                    </button>
                  ))}
                  {collections.length === 0 && (
                    <p className="py-2 text-xs text-amber-600">No collections yet.</p>
                  )}
                </div>

                {/* Create new collection */}
                <div className="mt-4 flex gap-2 border-t border-amber-100 pt-4">
                  <input
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleCreateCollection(); }}
                    placeholder="New collection…"
                    className="flex-1 rounded-xl border border-amber-200/70 bg-white/80 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleCreateCollection}
                    className="rounded-xl bg-amber-900 px-3 py-2 text-sm font-semibold text-amber-50"
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