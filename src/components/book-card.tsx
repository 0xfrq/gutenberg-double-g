"use client";

import Link from "next/link";
import { useMemo, useState, type ChangeEvent } from "react";

export type BookCardData = {
  id: string | number;
  title: string;
  authors?: { name: string }[] | null;
  authors_text?: string | null;
  subjects?: string[] | null;
  summary?: string | null;
  cover_image?: string | null;
  download_count?: number | null;
  source?: "gutenberg" | "upload";
};

type BookCardProps = {
  book: BookCardData;
  source: "gutenberg" | "upload";
  activeCollectionId?: string;
  onRefresh?: () => void;
};

const shelves = [
  { label: "Add to shelf", value: "" },
  { label: "To Read", value: "to-read" },
  { label: "Reading", value: "reading" },
  { label: "Finished", value: "finished" },
];

export default function BookCard({
  book,
  source,
  activeCollectionId,
  onRefresh,
}: BookCardProps) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const authors = useMemo(() => {
    if (book.authors && book.authors.length > 0) {
      return book.authors.map((author) => author.name).join(", ");
    }
    if (book.authors_text) {
      return book.authors_text;
    }
    return "Unknown author";
  }, [book]);

  const summary = book.summary
    ? `${book.summary.slice(0, 160)}${book.summary.length > 160 ? "..." : ""}`
    : "No summary yet.";

  const readHref =
    source === "upload" ? `/reader/${book.id}?source=upload` : `/reader/${book.id}`;

  const saveAction = async (url: string, body: object, success: string) => {
    setBusy(true);
    setStatus(null);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Could not save change");
      }
      setStatus(success);
      onRefresh?.();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save change");
    } finally {
      setBusy(false);
    }
  };

  const handleFavorite = () =>
    saveAction(
      "/api/library/favorites",
      { source, itemId: book.id },
      "Saved to favorites"
    );

  const handleShelfChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const shelf = event.target.value;
    if (!shelf) return;
    void saveAction(
      "/api/library/shelves",
      { shelf, source, itemId: book.id },
      `Moved to ${shelves.find((item) => item.value === shelf)?.label || "shelf"}`
    );
    event.target.value = "";
  };

  const handleCollectionAdd = () => {
    if (!activeCollectionId) return;
    void saveAction(
      "/api/library/collections/items",
      { collectionId: activeCollectionId, source, itemId: book.id },
      "Added to collection"
    );
  };

  return (
    <article className="group flex h-full flex-col border-b border-border pb-5">
      <div className="flex items-start gap-5">
        <div className="h-36 w-24 shrink-0 overflow-hidden bg-surface-muted shadow-[4px_4px_0_rgba(36,28,22,0.08)]">
          {book.cover_image ? (
            <img
              src={book.cover_image}
              alt={`${book.title} cover`}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-surface-muted px-2 text-center text-xs font-semibold text-muted">
              No cover
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
              {source === "upload" ? "Your upload" : "Gutenberg"}
            </span>
            {book.download_count ? (
              <span className="text-xs text-muted">
                {book.download_count.toLocaleString()} reads
              </span>
            ) : null}
          </div>
          <h3 className="font-serif text-xl leading-tight text-ink">
            {book.title}
          </h3>
          <p className="mt-1 text-sm text-muted">{authors}</p>
        </div>
      </div>
      <p className="mt-4 line-clamp-3 text-sm leading-6 text-muted">{summary}</p>
      <div className="mt-auto flex items-center gap-4 pt-5">
        <Link
          href={readHref}
          className="bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Read
        </Link>
        <details className="relative">
          <summary className="cursor-pointer list-none text-xs font-semibold text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
            More actions
          </summary>
          <div className="absolute bottom-8 left-0 z-10 flex min-w-44 flex-col gap-2 border border-border bg-surface p-3 shadow-lg">
            <button
              type="button"
              onClick={handleFavorite}
              disabled={busy}
              className="text-left text-xs text-ink transition-colors hover:text-primary disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Favorite
            </button>
            <label className="flex items-center justify-between gap-3 text-xs text-ink">
              Shelf
              <select
                onChange={handleShelfChange}
                defaultValue=""
                disabled={busy}
                className="border-b border-border bg-transparent py-1 text-xs focus:border-primary focus:outline-none"
              >
                {shelves.map((shelf) => (
                  <option key={shelf.value} value={shelf.value}>
                    {shelf.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={handleCollectionAdd}
              disabled={busy || !activeCollectionId}
              className="text-left text-xs text-ink transition-colors hover:text-primary disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Add to collection
            </button>
          </div>
        </details>
        {busy && <span className="text-xs text-muted" role="status">Saving…</span>}
        {!busy && status && <span className="text-xs text-muted" role="status">{status}</span>}
      </div>
    </article>
  );
}
