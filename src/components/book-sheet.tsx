"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import BookCover from "@/components/book-cover";
import { bookAuthors, readHref, type BookCardData, type BookSource } from "@/components/book-card";
import { Icon, Spinner } from "@/components/icons";
import { progressPercent, type BookProgress } from "@/lib/reading-progress";

export type SheetContext =
  | { kind: "shelf"; shelf: string; label: string }
  | { kind: "collection"; id: string; name: string };

export type SheetTarget = {
  book: BookCardData;
  source: BookSource;
  context?: SheetContext;
};

type BookSheetProps = {
  target: SheetTarget;
  collections: { id: string; name: string; count: number }[];
  isFavorite: boolean;
  progress?: BookProgress | null;
  onClose: () => void;
  onChanged: () => void;
};

const shelves = [
  { value: "to-read", label: "To read" },
  { value: "reading", label: "Reading" },
  { value: "finished", label: "Finished" },
];

const SAVE_FAILED = "That didn’t save. Check your connection and try again.";

function jsonPost(body: object): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function ToggleChip({
  label,
  on,
  busy,
  onClick,
}: {
  label: string;
  on: boolean;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-pressed={on}
      aria-busy={busy}
      className={`inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-sm font-semibold transition-soft active:scale-[0.97] disabled:cursor-wait disabled:opacity-70 ${
        on
          ? "border-transparent bg-accent-soft text-accent"
          : "border-rule-2 text-ink-2 hover:bg-paper-3 hover:text-ink"
      }`}
    >
      {busy ? <Spinner /> : <Icon name={on ? "check" : "plus"} size={16} />}
      {label}
    </button>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="mt-6">
      <legend className="text-sm font-semibold text-ink">{label}</legend>
      <div className="mt-2.5 flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

export default function BookSheet({
  target,
  collections,
  isFavorite,
  progress,
  onClose,
  onChanged,
}: BookSheetProps) {
  const { book, source, context } = target;
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closingRef = useRef(false);
  const [closing, setClosing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [favorite, setFavorite] = useState(isFavorite);
  const [status, setStatus] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [membership, setMembership] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (context?.kind === "shelf") initial.add(`shelf:${context.shelf}`);
    if (context?.kind === "collection") initial.add(`collection:${context.id}`);
    return initial;
  });

  const authors = bookAuthors(book, source);
  const percent = progressPercent(progress);
  const itemId = String(book.id);

  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    window.setTimeout(onClose, 180);
  }, [onClose]);

  // Lock the page behind the sheet, move focus in, and give it back on close.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus?.({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        requestClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [requestClose]);

  const send = async (key: string, url: string, init: RequestInit, success: string) => {
    setBusy(key);
    setStatus(null);
    try {
      const response = await fetch(url, init);
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || SAVE_FAILED);
      }
      setStatus({ tone: "ok", text: success });
      onChanged();
      return true;
    } catch (error) {
      setStatus({ tone: "error", text: error instanceof Error ? error.message : SAVE_FAILED });
      return false;
    } finally {
      setBusy(null);
    }
  };

  const setMember = (key: string, on: boolean) =>
    setMembership((current) => {
      const next = new Set(current);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });

  const toggleFavorite = async () => {
    const ok = favorite
      ? await send(
          "favorite",
          `/api/library/favorites?source=${source}&itemId=${encodeURIComponent(itemId)}`,
          { method: "DELETE" },
          "Removed from favorites"
        )
      : await send("favorite", "/api/library/favorites", jsonPost({ source, itemId }), "Added to favorites");
    if (ok) setFavorite(!favorite);
  };

  const toggleShelf = async (shelf: { value: string; label: string }) => {
    const key = `shelf:${shelf.value}`;
    const on = membership.has(key);
    const ok = on
      ? await send(
          key,
          `/api/library/shelves?shelf=${shelf.value}&source=${source}&itemId=${encodeURIComponent(itemId)}`,
          { method: "DELETE" },
          `Removed from ${shelf.label}`
        )
      : await send(key, "/api/library/shelves", jsonPost({ shelf: shelf.value, source, itemId }), `Added to ${shelf.label}`);
    if (ok) setMember(key, !on);
  };

  const toggleCollection = async (collection: { id: string; name: string }) => {
    const key = `collection:${collection.id}`;
    const on = membership.has(key);
    const ok = on
      ? await send(
          key,
          `/api/library/collections/items?collectionId=${encodeURIComponent(collection.id)}&source=${source}&itemId=${encodeURIComponent(itemId)}`,
          { method: "DELETE" },
          `Removed from ${collection.name}`
        )
      : await send(
          key,
          "/api/library/collections/items",
          jsonPost({ collectionId: collection.id, source, itemId }),
          `Added to ${collection.name}`
        );
    if (ok) setMember(key, !on);
  };

  const meta = [
    source === "upload" ? "EPUB you uploaded" : "Project Gutenberg",
    book.download_count ? `${book.download_count.toLocaleString()} downloads` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return createPortal(
    <div className="fixed inset-0 z-[400]" data-state={closing ? "closing" : "open"}>
      <div aria-hidden="true" onClick={requestClose} className="sheet-scrim absolute inset-0 bg-scrim" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="sheet-panel absolute inset-x-0 bottom-0 mx-auto flex max-h-[88dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-sheet bg-paper-2 shadow-sheet outline-none sm:bottom-6 sm:w-[calc(100%-3rem)] sm:rounded-sheet"
      >
        <div aria-hidden="true" className="flex justify-center pt-2.5">
          <span className="h-1 w-10 rounded-full bg-rule-2" />
        </div>

        <div className="overflow-y-auto overscroll-contain px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 sm:px-6">
          <div className="flex items-start gap-4">
            <BookCover title={book.title} src={book.cover_image} compact className="w-[4.5rem] shrink-0" />
            <div className="min-w-0 flex-1 pt-0.5">
              <h2 id={titleId} className="font-serif text-xl font-semibold leading-snug text-ink [overflow-wrap:anywhere]">
                {book.title}
              </h2>
              <p className="mt-1 text-sm text-ink-2">{authors}</p>
              <p className="mt-1 text-xs tabular-nums text-muted">{meta}</p>
            </div>
            <button
              type="button"
              onClick={requestClose}
              aria-label="Close"
              className="-mr-2 -mt-1 grid size-10 shrink-0 place-items-center rounded-full text-muted transition-soft hover:bg-paper-3 hover:text-ink"
            >
              <Icon name="x" />
            </button>
          </div>

          {book.summary ? (
            <div className="mt-4">
              <p className={`text-[0.9375rem] leading-relaxed text-ink-2 ${expanded ? "" : "line-clamp-4"}`}>
                {book.summary}
              </p>
              {book.summary.length > 240 ? (
                <button
                  type="button"
                  onClick={() => setExpanded((value) => !value)}
                  className="mt-1 rounded text-sm font-semibold text-accent hover:underline"
                >
                  {expanded ? "Show less" : "Read the full summary"}
                </button>
              ) : null}
            </div>
          ) : null}

          <Link
            href={readHref(book, source)}
            className="mt-5 flex h-12 w-full items-center justify-center gap-2 whitespace-nowrap rounded-full bg-accent text-[0.9375rem] font-semibold text-accent-ink transition-soft hover:bg-accent-hover active:scale-[0.98]"
          >
            <Icon name="book-open" size={18} />
            {percent > 0 ? `Continue reading · ${percent}%` : "Start reading"}
          </Link>

          <button
            type="button"
            onClick={toggleFavorite}
            disabled={busy === "favorite"}
            aria-pressed={favorite}
            className="mt-3 flex h-12 w-full items-center gap-3 rounded-full bg-paper-3 px-5 text-left text-[0.9375rem] font-semibold text-ink transition-soft hover:bg-rule active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
          >
            {busy === "favorite" ? (
              <Spinner className="size-[18px]" />
            ) : (
              <Icon name="heart" size={18} filled={favorite} className={favorite ? "text-accent" : "text-muted"} />
            )}
            {favorite ? "In your favorites" : "Add to favorites"}
            {favorite ? <span className="ml-auto text-sm font-medium text-muted">Remove</span> : null}
          </button>

          <Group label="Shelves">
            {shelves.map((shelf) => (
              <ToggleChip
                key={shelf.value}
                label={shelf.label}
                on={membership.has(`shelf:${shelf.value}`)}
                busy={busy === `shelf:${shelf.value}`}
                onClick={() => void toggleShelf(shelf)}
              />
            ))}
          </Group>

          <Group label="Collections">
            {collections.length > 0 ? (
              collections.map((collection) => (
                <ToggleChip
                  key={collection.id}
                  label={collection.name}
                  on={membership.has(`collection:${collection.id}`)}
                  busy={busy === `collection:${collection.id}`}
                  onClick={() => void toggleCollection(collection)}
                />
              ))
            ) : (
              <p className="text-sm text-muted">No collections yet. Make one in the Collections tab.</p>
            )}
          </Group>

          <p
            role="status"
            aria-live="polite"
            className={status?.tone === "error" ? "mt-5 text-sm font-medium text-danger" : "sr-only"}
          >
            {status?.text ?? ""}
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
