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

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const collectionId = body?.collectionId ? String(body.collectionId) : "";
  const source = body?.source === "upload" ? "upload" : "gutenberg";
  const itemId = body?.itemId ? String(body.itemId) : "";

  if (!collectionId || !itemId) {
    return NextResponse.json(
      { error: "Missing collectionId or itemId" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  try {
    if (source === "gutenberg") {
      await ensureGutenbergBook(Number(itemId));
    }

    const { error } = await supabase.from("collection_items").upsert(
      { collection_id: collectionId, source, item_id: itemId },
      { onConflict: "collection_id,source,item_id" }
    );

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
  const collectionId = request.nextUrl.searchParams.get("collectionId") || "";
  const source = request.nextUrl.searchParams.get("source") || "gutenberg";
  const itemId = request.nextUrl.searchParams.get("itemId") || "";

  if (!collectionId || !itemId) {
    return NextResponse.json(
      { error: "Missing collectionId or itemId" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("collection_items")
    .delete()
    .match({ collection_id: collectionId, source, item_id: itemId });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
