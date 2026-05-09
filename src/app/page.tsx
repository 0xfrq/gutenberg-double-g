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

export default function Home() {
  const [query, setQuery] = useState("");
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

  const resolveSource = useCallback((book: BookCardData) => {
    if (book.source === "upload" || book.source === "gutenberg") {
      return book.source;
    }
    return book.authors_text === "You" ? "upload" : "gutenberg";
  }, []);

  const fetchJson = useCallback(async <T,>(
    url: string,
    init?: RequestInit
  ) => {
    const response = await fetch(url, init);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Request failed");
    }
    return data as T;
  }, []);

  const loadCollections = useCallback(async () => {
    const data = await fetchJson<CollectionsResponse>("/api/library/collections");
    setCollections(data.collections || []);
    if (!activeCollectionId && data.collections?.length) {
      setActiveCollectionId(data.collections[0].id);
    }
  }, [activeCollectionId, fetchJson]);

  const loadCollectionItems = useCallback(
    async (collectionId: string) => {
      if (!collectionId) {
        setCollectionItems([]);
        return;
      }
      const data = await fetchJson<CollectionItemsResponse>(
        `/api/library/collections?collectionId=${encodeURIComponent(
          collectionId
        )}`
      );
      setCollectionItems(data.items || []);
    },
    [fetchJson]
  );

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
    const data = await fetchJson<RecommendationResponse>(
      "/api/library/recommendations"
    );
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

  const runSearch = useCallback(
    async (value: string) => {
      setLoading(true);
      try {
        const encoded = encodeURIComponent(value);
        const [libraryData, gutenbergData] = await Promise.all([
          fetchJson<LibraryResponse>(`/api/library/books?q=${encoded}`),
          fetchJson<any>(
            `/api/gutenberg/books${value ? `?search=${encoded}` : ""}`
          ),
        ]);

        setLibraryBooks(libraryData.cached || []);
        const uploadCards = (libraryData.uploads || []).map((upload) => ({
          id: upload.id,
          title: upload.title,
          summary: "Personal upload",
          authors_text: "You",
        }));
        setUploads(uploadCards);

        const remoteResults = Array.isArray(gutenbergData?.results)
          ? gutenbergData.results
          : [];
        setGutenbergBooks(remoteResults);
      } finally {
        setLoading(false);
      }
    },
    [fetchJson]
  );

  const refreshPanels = useCallback(async () => {
    await Promise.all([
      loadFavorites(),
      loadShelf(),
      loadCollections(),
      loadUploads(),
    ]);
    if (activeCollectionId) {
      await loadCollectionItems(activeCollectionId);
    }
  }, [
    activeCollectionId,
    loadCollectionItems,
    loadCollections,
    loadFavorites,
    loadShelf,
    loadUploads,
  ]);

  useEffect(() => {
    runSearch("");
    loadRecommended();
  }, [runSearch, loadRecommended]);

  useEffect(() => {
    refreshPanels();
  }, [refreshPanels]);

  useEffect(() => {
    loadShelf();
  }, [activeShelf, loadShelf]);

  useEffect(() => {
    if (activeCollectionId) {
      loadCollectionItems(activeCollectionId);
    }
  }, [activeCollectionId, loadCollectionItems]);

  const handleSearchSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await runSearch(query);
  };

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) {
      return;
    }

    const response = await fetchJson<{ collection: { id: string } }>(
      "/api/library/collections",
      {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCollectionName.trim() }),
      }
    );

    setNewCollectionName("");
    if (response?.collection?.id) {
      setActiveCollectionId(response.collection.id);
    }
    await loadCollections();
  };

  const heroLabel = useMemo(() => {
    if (loading) {
      return "Searching...";
    }
    if (query) {
      return `Results for "${query}"`;
    }
    return "Discover";
  }, [loading, query]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#f8f1e7_20%,#f4ece1_60%,#efe2d0_100%)] text-amber-950">
      <header className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-32 top-10 h-72 w-72 rounded-full bg-amber-200/40 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 top-40 h-56 w-56 rounded-full bg-teal-200/40 blur-3xl" />
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-700">
            Your private Gutenberg shelf
          </p>
          <div className="flex flex-col gap-4">
            <h1 className="text-4xl font-semibold text-amber-950 md:text-5xl">
              DoubleG Reader
            </h1>
            <p className="max-w-2xl text-base text-amber-900/80">
              Search Project Gutenberg, cache EPUBs, and
              keep a personal shelf with collections, favorites, and a fully
              customizable reader.
            </p>
          </div>
          <form
            onSubmit={handleSearchSubmit}
            className="flex w-full max-w-2xl flex-col gap-3 rounded-3xl border border-amber-200/70 bg-white/70 p-4 shadow-sm backdrop-blur md:flex-row"
          >
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by title, author, or subject"
              className="flex-1 rounded-2xl border border-amber-200/70 bg-white/80 px-4 py-3 text-sm text-amber-900"
            />
            <button
              type="submit"
              className="rounded-2xl bg-amber-900 px-5 py-3 text-sm font-semibold text-amber-50 transition hover:bg-amber-800"
            >
              Search
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl gap-8 px-6 pb-20 lg:grid-cols-[280px_1fr]">
        <aside className="flex flex-col gap-6">
          <div className="rounded-3xl border border-amber-100/60 bg-white/70 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-800">
              Shelf
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {shelfTabs.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setActiveShelf(tab.value)}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                    activeShelf === tab.value
                      ? "bg-amber-900 text-amber-50"
                      : "border border-amber-300/80 text-amber-900 hover:bg-amber-100"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-amber-100/60 bg-white/70 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-800">
              Collections
            </p>
            <div className="mt-3 flex flex-col gap-3">
              <select
                value={activeCollectionId}
                onChange={(event) => setActiveCollectionId(event.target.value)}
                className="rounded-2xl border border-amber-200/70 bg-white/80 px-3 py-2 text-sm"
              >
                <option value="">Pick collection</option>
                {collections.map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collection.name} ({collection.count})
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <input
                  value={newCollectionName}
                  onChange={(event) => setNewCollectionName(event.target.value)}
                  placeholder="New collection"
                  className="flex-1 rounded-2xl border border-amber-200/70 bg-white/80 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={handleCreateCollection}
                  className="rounded-2xl bg-amber-900 px-3 py-2 text-sm font-semibold text-amber-50"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          <UploadPanel onUploaded={refreshPanels} />
        </aside>

        <section className="flex flex-col gap-10">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-amber-950">Recommended</h2>
              <p className="text-xs uppercase tracking-widest text-amber-700">
                Based on favorites
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {recommended.map((book) => (
                <BookCard
                  key={book.id}
                  book={book}
                  source="gutenberg"
                  activeCollectionId={activeCollectionId}
                  onRefresh={refreshPanels}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-amber-950">Shelf</h2>
              <p className="text-xs uppercase tracking-widest text-amber-700">
                {activeShelf}
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {shelf.map((book) => (
                <BookCard
                  key={book.id}
                  book={book}
                  source={resolveSource(book)}
                  activeCollectionId={activeCollectionId}
                  onRefresh={refreshPanels}
                />
              ))}
              {shelf.length === 0 ? (
                <p className="text-sm text-amber-800">
                  Nothing on this shelf yet.
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-amber-950">Favorites</h2>
              <p className="text-xs uppercase tracking-widest text-amber-700">
                Saved highlights
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {favorites.map((book) => (
                <BookCard
                  key={book.id}
                  book={book}
                  source={resolveSource(book)}
                  activeCollectionId={activeCollectionId}
                  onRefresh={refreshPanels}
                />
              ))}
              {favorites.length === 0 ? (
                <p className="text-sm text-amber-800">
                  Add favorites to shape recommendations.
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-amber-950">
                {heroLabel}
              </h2>
              <p className="text-xs uppercase tracking-widest text-amber-700">
                Gutenberg
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {gutenbergBooks.map((book) => (
                <BookCard
                  key={book.id}
                  book={book}
                  source="gutenberg"
                  activeCollectionId={activeCollectionId}
                  onRefresh={refreshPanels}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-amber-950">
                From your library
              </h2>
              <p className="text-xs uppercase tracking-widest text-amber-700">
                Cached + uploads
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {libraryBooks.map((book) => (
                <BookCard
                  key={book.id}
                  book={book}
                  source="gutenberg"
                  activeCollectionId={activeCollectionId}
                  onRefresh={refreshPanels}
                />
              ))}
              {uploads.map((upload) => (
                <BookCard
                  key={upload.id}
                  book={upload}
                  source="upload"
                  activeCollectionId={activeCollectionId}
                  onRefresh={refreshPanels}
                />
              ))}
            </div>
          </div>

          {activeCollectionId ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-amber-950">
                  Collection picks
                </h2>
                <p className="text-xs uppercase tracking-widest text-amber-700">
                  {collections.find((c) => c.id === activeCollectionId)?.name}
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {collectionItems.map((book) => (
                  <BookCard
                    key={book.id}
                    book={book}
                    source={resolveSource(book)}
                    activeCollectionId={activeCollectionId}
                    onRefresh={refreshPanels}
                  />
                ))}
                {collectionItems.length === 0 ? (
                  <p className="text-sm text-amber-800">
                    Add books to this collection to see them here.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
