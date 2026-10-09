"use client";

import Link from "next/link";
import BookCover from "@/components/book-cover";
import { Icon } from "@/components/icons";
import { progressPercent, type BookProgress } from "@/lib/reading-progress";

export type BookSource = "gutenberg" | "upload";

export type BookCardData = {
  id: string | number;
  title: string;
  authors?: { name: string }[] | null;
  authors_text?: string | null;
  subjects?: string[] | null;
  summary?: string | null;
  cover_image?: string | null;
  download_count?: number | null;
  source?: BookSource;
};

// Gutenberg lists people as "Doyle, Arthur Conan (Arthur)". Readers expect
// "Arthur Conan Doyle".
function formatPersonName(name: string) {
  const clean = name.replace(/\s*\([^)]*\)/g, "").trim();
  const parts = clean.split(",").map((part) => part.trim());
  if (parts.length === 2 && parts[0] && parts[1]) return `${parts[1]} ${parts[0]}`;
  return clean;
}

export function bookAuthors(book: BookCardData, source: BookSource) {
  if (source === "upload") return "Your upload";
  if (book.authors && book.authors.length > 0) {
    return book.authors.map((author) => formatPersonName(author.name)).join(", ");
  }
  if (book.authors_text) return book.authors_text;
  return "Unknown author";
}

export function readHref(book: BookCardData, source: BookSource) {
  return source === "upload" ? `/reader/${book.id}?source=upload` : `/reader/${book.id}`;
}

export function ProgressBar({ percent, className = "" }: { percent: number; className?: string }) {
  return (
    <div
      role="progressbar"
      aria-label="Reading progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={`h-1 overflow-hidden rounded-full bg-rule ${className}`}
    >
      <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(percent, 2)}%` }} />
    </div>
  );
}

type BookCardProps = {
  book: BookCardData;
  source: BookSource;
  progress?: BookProgress | null;
  onMore?: () => void;
  variant?: "grid" | "continue";
};

export default function BookCard({
  book,
  source,
  progress,
  onMore,
  variant = "grid",
}: BookCardProps) {
  const authors = bookAuthors(book, source);
  const href = readHref(book, source);
  const percent = progressPercent(progress);
  const coverAuthor = source === "upload" ? undefined : authors;

  const moreButton = onMore ? (
    <button
      type="button"
      onClick={onMore}
      aria-label={`Options for ${book.title}`}
      className="grid size-10 shrink-0 place-items-center rounded-full text-muted transition-soft hover:bg-paper-3 hover:text-ink active:scale-95"
    >
      <Icon name="more" />
    </button>
  ) : null;

  if (variant === "continue") {
    return (
      <article className="flex items-center gap-1 rounded-card bg-paper-2 p-3 pr-1.5 ring-1 ring-rule">
        <Link href={href} className="flex min-w-0 flex-1 items-center gap-3.5 rounded-xl">
          <BookCover
            title={book.title}
            src={book.cover_image}
            compact
            className="w-[3.75rem] shrink-0"
          />
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 font-serif text-[0.9375rem] font-semibold leading-snug text-ink">
              {book.title}
            </h3>
            <p className="mt-0.5 truncate text-[0.8125rem] text-muted">{authors}</p>
            <ProgressBar percent={percent} className="mt-3" />
            <p className="mt-1.5 text-xs tabular-nums text-muted">
              {percent}% · page {progress?.page ?? 1} of {progress?.total ?? "—"}
            </p>
          </div>
        </Link>
        {moreButton}
      </article>
    );
  }

  return (
    <article className="relative min-w-0">
      <Link href={href} className="group block rounded-cover">
        <BookCover
          title={book.title}
          author={coverAuthor}
          src={book.cover_image}
          className="transition-soft group-hover:-translate-y-0.5"
        />
        {percent > 0 ? <ProgressBar percent={percent} className="mt-2.5" /> : null}
        <div className="mt-2.5 pr-9">
          <h3 className="line-clamp-2 font-serif text-[0.9375rem] font-semibold leading-snug text-ink">
            {book.title}
          </h3>
          <p className="mt-0.5 truncate text-[0.8125rem] text-muted">{authors}</p>
        </div>
      </Link>
      {moreButton ? <div className="absolute bottom-0 right-0 -mr-2">{moreButton}</div> : null}
    </article>
  );
}
