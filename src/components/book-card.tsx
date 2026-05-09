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

  const handleFavorite = async () => {
    setBusy(true);
    await fetch("/api/library/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source, itemId: book.id }),
    });
    onRefresh?.();
    setBusy(false);
  };

  const handleShelfChange = async (event: ChangeEvent<HTMLSelectElement>) => {
    const shelf = event.target.value;
    if (!shelf) {
      return;
    }

    setBusy(true);
    await fetch("/api/library/shelves", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shelf, source, itemId: book.id }),
    });
    onRefresh?.();
    setBusy(false);
    event.target.value = "";
  };

  const handleCollectionAdd = async () => {
    if (!activeCollectionId) {
      return;
    }

    setBusy(true);
    await fetch("/api/library/collections/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        collectionId: activeCollectionId,
        source,
        itemId: book.id,
      }),
    });
    onRefresh?.();
    setBusy(false);
  };

  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-3xl border border-amber-100/60 bg-white/70 p-4 shadow-sm backdrop-blur">
      <div className="flex items-start gap-4">
        <div className="h-24 w-16 shrink-0 overflow-hidden rounded-xl bg-amber-100/70">
          {book.cover_image ? (
            <img
              src={book.cover_image}
              alt={`${book.title} cover`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-amber-200 via-amber-100 to-transparent text-xs font-semibold text-amber-800">
              No cover
            </div>
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between gap-3">
            <span className="rounded-full bg-amber-200/70 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-amber-900">
              {source === "upload" ? "Upload" : "Gutenberg"}
            </span>
            {book.download_count ? (
              <span className="text-xs text-amber-900/70">
                {book.download_count.toLocaleString()} reads
              </span>
            ) : null}
          </div>
          <h3 className="mt-3 text-lg font-semibold text-amber-950">
            {book.title}
          </h3>
          <p className="text-sm text-amber-900/80">{authors}</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-amber-900/70">{summary}</p>
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
        <Link
          href={readHref}
          className="rounded-full bg-amber-900 px-4 py-2 text-sm font-semibold text-amber-50 transition hover:bg-amber-800"
        >
          Read
        </Link>
        <button
          type="button"
          onClick={handleFavorite}
          disabled={busy}
          className="rounded-full border border-amber-300/80 px-4 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-100"
        >
          Favorite
        </button>
        <select
          className="rounded-full border border-amber-300/80 bg-white/70 px-3 py-2 text-sm text-amber-900"
          onChange={handleShelfChange}
          defaultValue=""
          disabled={busy}
        >
          {shelves.map((shelf) => (
            <option key={shelf.value} value={shelf.value}>
              {shelf.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleCollectionAdd}
          disabled={busy || !activeCollectionId}
          className="rounded-full border border-amber-300/80 px-4 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-100 disabled:opacity-40"
        >
          Add to collection
        </button>
      </div>
    </div>
  );
}
