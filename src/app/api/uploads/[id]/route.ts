import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getStorageBucket } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = createServiceClient();
  const bucket = getStorageBucket();

  const { data, error } = await supabase
    .from("uploads")
    .select("id, title, file_path")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Upload not found" }, { status: 404 });
  }

  const signed = await supabase.storage
    .from(bucket)
    .createSignedUrl(data.file_path, 60 * 60);

  if (signed.error) {
    return NextResponse.json({ error: signed.error.message }, { status: 500 });
  }

  return NextResponse.json({
    upload: { id: data.id, title: data.title },
    signedUrl: signed.data?.signedUrl || null,
  });
}
