import { requireEnv } from "./env";

export type GutenbergAuthor = {
  id: number;
  name: string;
};

export type GutenbergBook = {
  id: number;
  title: string;
  alternative_title?: string | null;
  authors: GutenbergAuthor[];
  subjects: string[];
  bookshelves: string[];
  formats: Record<string, string>;
  summary?: string | null;
  cover_image?: string | null;
  download_count?: number | null;
  issued?: string | null;
  reading_ease_score?: string | number | null;
};

export type GutenbergListResponse = {
  next?: string | null;
  previous?: string | null;
  results: GutenbergBook[];
};

function getHeaders() {
  const host = requireEnv("RAPIDAPI_HOST");
  const key = requireEnv("RAPIDAPI_KEY");
  return {
    "Content-Type": "application/json",
    "x-rapidapi-host": host,
    "x-rapidapi-key": key,
  };
}

export async function gutenbergFetch<T>(
  path: string,
  searchParams?: URLSearchParams
): Promise<T> {
  const host = requireEnv("RAPIDAPI_HOST");
  const baseUrl = `https://${host}`;
  const url = new URL(`${baseUrl}/${path.replace(/^\//, "")}`);
  if (searchParams) {
    searchParams.forEach((value, key) => url.searchParams.set(key, value));
  }

  const response = await fetch(url.toString(), {
    headers: getHeaders(),
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    throw new Error(`Gutenberg request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function getBookById(id: number): Promise<GutenbergBook> {
  const data = await gutenbergFetch<GutenbergListResponse>(`books/${id}`);
  const book = data.results?.[0];
  if (!book) {
    throw new Error(`Book ${id} not found`);
  }
  return book;
}
