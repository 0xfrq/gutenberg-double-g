import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getStorageBucket } from "@/lib/supabase/server";
import { getBookById } from "@/lib/gutenberg";
import { bookToDb, pickEpubUrl, pickReadableUrl } from "@/lib/library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const id = body?.id ? Number(body.id) : NaN;

  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const bucket = getStorageBucket();

  try {
    const { data: existing } = await supabase
      .from("book_cache")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (existing?.epub_path) {
      const signed = await supabase.storage
        .from(bucket)
        .createSignedUrl(existing.epub_path, 60 * 60);

      if (!signed.error) {
        return NextResponse.json({
          book: existing,
          signedUrl: signed.data?.signedUrl || null,
        });
      }
    }

    const book = await getBookById(id);
    console.log("raw API response:", JSON.stringify(book, null, 2));

    // RapidAPI may return the id under a different key; always enforce it
    if (!book.id) {
    (book as any).id = id;
    }
    const row = bookToDb(book);

    const epubUrl = row.epub_url || pickEpubUrl(book.formats);
    const readable = pickReadableUrl(book.formats);

    const record = { ...row, epub_path: null };

    const { error: recordError } = await supabase
      .from("book_cache")
      .upsert(record, { onConflict: "id" });

    if (recordError) {
      return NextResponse.json({ error: recordError.message }, { status: 500 });
    }

    if (!epubUrl) {
      if (!readable) {
        return NextResponse.json(
          { error: "No epub format found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        book: record,
        signedUrl: null,
        fallbackUrl: readable.url,
        fallbackKind: readable.kind,
      });
    }

    const download = await fetch(epubUrl);
    if (!download.ok) {
      return NextResponse.json(
        { error: "Failed to download epub" },
        { status: 502 }
      );
    }

    const buffer = Buffer.from(await download.arrayBuffer());
    const epubPath = `gutenberg/${id}.epub`;

    const upload = await supabase.storage.from(bucket).upload(epubPath, buffer, {
      contentType: "application/epub+zip",
      upsert: true,
    });

    if (upload.error) {
      return NextResponse.json({ error: upload.error.message }, { status: 500 });
    }

    const recordWithEpub = { ...row, epub_path: epubPath };
    const { error } = await supabase
      .from("book_cache")
      .upsert(recordWithEpub, { onConflict: "id" });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const signed = await supabase.storage
      .from(bucket)
      .createSignedUrl(epubPath, 60 * 60);

    return NextResponse.json({
      book: recordWithEpub,
      signedUrl: signed.data?.signedUrl || null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
