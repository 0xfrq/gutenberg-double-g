import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const collectionId = request.nextUrl.searchParams.get("collectionId");
  const supabase = createServiceClient();

  if (!collectionId) {
    const { data: collections, error } = await supabase
      .from("collections")
      .select("id, name, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: items } = await supabase
      .from("collection_items")
      .select("collection_id");

    const counts = new Map<string, number>();
    (items || []).forEach((item) => {
      const current = counts.get(item.collection_id) || 0;
      counts.set(item.collection_id, current + 1);
    });

    const withCounts = (collections || []).map((collection) => ({
      ...collection,
      count: counts.get(collection.id) || 0,
    }));

    return NextResponse.json({ collections: withCounts });
  }

  const { data: items, error } = await supabase
    .from("collection_items")
    .select("source, item_id, created_at")
    .eq("collection_id", collectionId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const gutenbergIds = (items || [])
    .filter((item) => item.source === "gutenberg")
    .map((item) => Number(item.item_id))
    .filter((id) => Number.isFinite(id));

  const uploadIds = (items || [])
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

  const merged = (items || [])
    .map((item) => {
      if (item.source === "gutenberg") {
        const book = bookMap.get(String(item.item_id));
        if (!book) {
          return null;
        }
        return { source: "gutenberg", item_id: item.item_id, ...book };
      }

      const upload = uploadMap.get(String(item.item_id));
      if (!upload) {
        return null;
      }
      return { source: "upload", item_id: item.item_id, ...upload };
    })
    .filter(Boolean);

  return NextResponse.json({ items: merged });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const name = body?.name ? String(body.name).trim() : "";

  if (!name) {
    return NextResponse.json({ error: "Missing name" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("collections")
    .insert({ name })
    .select("id, name")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ collection: data });
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id") || "";

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase.from("collections").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
