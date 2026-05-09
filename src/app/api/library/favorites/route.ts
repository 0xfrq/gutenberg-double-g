import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getBookById } from "@/lib/gutenberg";
import { bookToDb } from "@/lib/library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ensureGutenbergBook(id: number) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("book_cache")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (data) {
    return;
  }

  const book = await getBookById(id);
  const row = bookToDb(book);
  await supabase.from("book_cache").upsert(row, { onConflict: "id" });
}

export async function GET() {
  const supabase = createServiceClient();
  const { data: favorites, error } = await supabase
    .from("favorites")
    .select("source, item_id, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const gutenbergIds = (favorites || [])
    .filter((item) => item.source === "gutenberg")
    .map((item) => Number(item.item_id))
    .filter((id) => Number.isFinite(id));

  const uploadIds = (favorites || [])
    .filter((item) => item.source === "upload")
    .map((item) => item.item_id);

  const { data: books } = gutenbergIds.length
    ? await supabase
        .from("book_cache")
        .select(
          "id, title, authors, authors_text, subjects, summary, cover_image, download_count"
        )
        .in("id", gutenbergIds)
    : { data: [] };

  const { data: uploads } = uploadIds.length
    ? await supabase.from("uploads").select("id, title").in("id", uploadIds)
    : { data: [] };

  const bookMap = new Map(
    (books || []).map((book) => [String(book.id), book])
  );
  const uploadMap = new Map(
    (uploads || []).map((upload) => [String(upload.id), upload])
  );

  const items = (favorites || [])
    .map((favorite) => {
      if (favorite.source === "gutenberg") {
        const book = bookMap.get(String(favorite.item_id));
        if (!book) {
          return null;
        }
        return { source: "gutenberg", item_id: favorite.item_id, ...book };
      }

      const upload = uploadMap.get(String(favorite.item_id));
      if (!upload) {
        return null;
      }
      return { source: "upload", item_id: favorite.item_id, ...upload };
    })
    .filter(Boolean);

  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const source = body?.source === "upload" ? "upload" : "gutenberg";
  const itemId = body?.itemId ? String(body.itemId) : "";

  if (!itemId) {
    return NextResponse.json({ error: "Missing itemId" }, { status: 400 });
  }

  const supabase = createServiceClient();

  try {
    if (source === "gutenberg") {
      await ensureGutenbergBook(Number(itemId));
    }

    const { error } = await supabase
      .from("favorites")
      .upsert({ source, item_id: itemId }, { onConflict: "source,item_id" });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const source = request.nextUrl.searchParams.get("source") || "gutenberg";
  const itemId = request.nextUrl.searchParams.get("itemId") || "";

  if (!itemId) {
    return NextResponse.json({ error: "Missing itemId" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("favorites")
    .delete()
    .match({ source, item_id: itemId });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
