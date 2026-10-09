import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { gutenbergFetch, GutenbergListResponse } from "@/lib/gutenberg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// How many favorite subjects to try before giving up — each try is one
// catalogue request.
const MAX_SUBJECT_TRIES = 3;

function rankSubjects(books: { subjects?: string[] | null }[]) {
  const counts = new Map<string, number>();
  books.forEach((book) => {
    (book.subjects || []).forEach((subject) => {
      const current = counts.get(subject) || 0;
      counts.set(subject, current + 1);
    });
  });

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([subject]) => subject);
}

// Gutenberg subjects look like "England -- Social life and customs -- Fiction".
// The catalogue search matches the leading heading far more reliably.
function searchableSubject(subject: string) {
  return subject.split(" -- ")[0].replace(/\([^)]*\)/g, "").trim();
}

export async function GET() {
  const supabase = createServiceClient();
  const { data: favorites } = await supabase
    .from("favorites")
    .select("source, item_id")
    .order("created_at", { ascending: false })
    .limit(12);

  const gutenbergIds = (favorites || [])
    .filter((favorite) => favorite.source === "gutenberg")
    .map((favorite) => Number(favorite.item_id))
    .filter((id) => Number.isFinite(id));

  const subjects: string[] = [];

  if (gutenbergIds.length > 0) {
    const { data: books } = await supabase
      .from("book_cache")
      .select("subjects")
      .in("id", gutenbergIds);

    for (const subject of rankSubjects(books || [])) {
      const query = searchableSubject(subject);
      if (query && !subjects.includes(query)) subjects.push(query);
      if (subjects.length === MAX_SUBJECT_TRIES) break;
    }
  }

  const favoriteIds = new Set(gutenbergIds);

  // The catalogue searches with `q`; a `search` parameter is silently ignored.
  for (const subject of subjects) {
    const response = await gutenbergFetch<GutenbergListResponse>(
      "books",
      new URLSearchParams({ q: subject })
    );
    const results = (response.results || []).filter((book) => !favoriteIds.has(book.id));
    if (results.length > 0) {
      return NextResponse.json({ seed: subject, results });
    }
  }

  // No favorites, or none of their subjects matched: no personal seed.
  const response = await gutenbergFetch<GutenbergListResponse>(
    "books",
    new URLSearchParams({ page: "1" })
  );

  return NextResponse.json({ seed: "", results: response.results || [] });
}
