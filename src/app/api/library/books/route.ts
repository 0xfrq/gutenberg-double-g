import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { normalizeQuery } from "@/lib/library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") || "";
  const search = normalizeQuery(query);
  const supabase = createServiceClient();

  try {
    let bookQuery = supabase
      .from("book_cache")
      .select(
        "id, title, authors, authors_text, subjects, bookshelves, summary, cover_image, download_count, issued, reading_ease_score"
      )
      .order("download_count", { ascending: false })
      .limit(36);

    if (search) {
      bookQuery = bookQuery.or(
        `title.ilike.%${search}%,authors_text.ilike.%${search}%,subjects_text.ilike.%${search}%,bookshelves_text.ilike.%${search}%`
      );
    }

    const { data: cached, error: cachedError } = await bookQuery;

    if (cachedError) {
      return NextResponse.json({ error: cachedError.message }, { status: 500 });
    }

    let uploadsQuery = supabase
      .from("uploads")
      .select("id, title, created_at")
      .order("created_at", { ascending: false })
      .limit(24);

    if (search) {
      uploadsQuery = uploadsQuery.ilike("title", `%${search}%`);
    }

    const { data: uploads, error: uploadsError } = await uploadsQuery;

    if (uploadsError) {
      return NextResponse.json({ error: uploadsError.message }, { status: 500 });
    }

    return NextResponse.json({ cached: cached || [], uploads: uploads || [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
