import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getStorageBucket } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("uploads")
    .select("id, title, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ uploads: data || [] });
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file");
  const title = formData.get("title");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const safeTitle =
    typeof title === "string" && title.trim().length > 0
      ? title.trim()
      : file.name.replace(/\.epub$/i, "") || "Untitled";

  const id = crypto.randomUUID();
  const path = `uploads/${id}.epub`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const supabase = createServiceClient();
  const bucket = getStorageBucket();

  const upload = await supabase.storage.from(bucket).upload(path, buffer, {
    contentType: file.type || "application/epub+zip",
    upsert: false,
  });

  if (upload.error) {
    return NextResponse.json({ error: upload.error.message }, { status: 500 });
  }

  const { error } = await supabase
    .from("uploads")
    .insert({ id, title: safeTitle, file_path: path });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ upload: { id, title: safeTitle } });
}
