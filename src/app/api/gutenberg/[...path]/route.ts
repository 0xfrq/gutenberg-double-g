import { NextRequest, NextResponse } from "next/server";
import { requireEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const host = requireEnv("RAPIDAPI_HOST");
  const key = requireEnv("RAPIDAPI_KEY");
  const baseUrl = `https://${host}`;
  const { path } = await context.params;
  const routePath = Array.isArray(path) ? path.join("/") : "";
  const url = new URL(`${baseUrl}/${routePath}`);

  request.nextUrl.searchParams.forEach((value, name) => {
    url.searchParams.set(name, value);
  });

  const response = await fetch(url.toString(), {
    headers: {
      "Content-Type": "application/json",
      "x-rapidapi-host": host,
      "x-rapidapi-key": key,
    },
    next: { revalidate: 0 },
  });

  const body = await response.text();

  return new NextResponse(body, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") || "application/json",
    },
  });
}
