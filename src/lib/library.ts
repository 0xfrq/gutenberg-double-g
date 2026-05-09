import type { GutenbergBook } from "./gutenberg";

export function pickEpubUrl(formats?: Record<string, string>) {
  if (!formats) {
    return null;
  }

  const entry = Object.entries(formats).find(([key]) =>
    key.toLowerCase().startsWith("application/epub+zip")
  );
  return entry ? entry[1] : null;
}

export type ReadableFormat = {
  url: string;
  kind: "html" | "text";
};

export function pickReadableUrl(
  formats?: Record<string, string>
): ReadableFormat | null {
  if (!formats) {
    return null;
  }

  const entries = Object.entries(formats);
  const htmlEntry = entries.find(([key]) =>
    key.toLowerCase().startsWith("text/html")
  );
  if (htmlEntry) {
    return { url: htmlEntry[1], kind: "html" };
  }

  const textEntry = entries.find(([key]) =>
    key.toLowerCase().startsWith("text/plain")
  );
  if (textEntry) {
    return { url: textEntry[1], kind: "text" };
  }

  return null;
}

export function normalizeQuery(input: string) {
  return input.replace(/[%,]/g, " ").trim();
}

export function bookToDb(book: GutenbergBook) {
  const authorsText = book.authors?.map((author) => author.name).join(", ") || "";
  const subjectsText = book.subjects?.join(", ") || "";
  const shelvesText = book.bookshelves?.join(", ") || "";
  const readingEase =
    book.reading_ease_score !== null && book.reading_ease_score !== undefined
      ? Number(book.reading_ease_score)
      : null;

  return {
    id: book.id,
    title: book.title,
    alternative_title: book.alternative_title || null,
    authors: book.authors || [],
    authors_text: authorsText,
    subjects: book.subjects || [],
    subjects_text: subjectsText,
    bookshelves: book.bookshelves || [],
    bookshelves_text: shelvesText,
    summary: book.summary || null,
    cover_image: book.cover_image || null,
    formats: book.formats || {},
    epub_url: pickEpubUrl(book.formats),
    download_count: book.download_count || null,
    issued: book.issued || null,
    reading_ease_score: Number.isFinite(readingEase) ? readingEase : null,
  };
}
