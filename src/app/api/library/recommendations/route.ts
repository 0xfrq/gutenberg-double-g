import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { gutenbergFetch, GutenbergListResponse } from "@/lib/gutenberg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pickTopSubject(books: { subjects?: string[] | null }[]) {
  const counts = new Map<string, number>();
  books.forEach((book) => {
    (book.subjects || []).forEach((subject) => {
      const current = counts.get(subject) || 0;
      counts.set(subject, current + 1);
    });
  });

  let top = "";
  let score = 0;
  counts.forEach((count, subject) => {
    if (count > score) {
      top = subject;
      score = count;
    }
  });

  return top;
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

  let seed = "";

  if (gutenbergIds.length > 0) {
    const { data: books } = await supabase
      .from("book_cache")
      .select("subjects")
      .in("id", gutenbergIds);

    seed = pickTopSubject(books || []);
  }

  const searchParams = new URLSearchParams();
  if (seed) {
    searchParams.set("search", seed);
  }
  searchParams.set("page", "1");

  const response = await gutenbergFetch<GutenbergListResponse>(
    "books",
    searchParams
  );

  return NextResponse.json({ seed, results: response.results || [] });
}
