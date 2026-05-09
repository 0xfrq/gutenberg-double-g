import "server-only";
import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "../env";

export function createServiceClient() {
  const url = requireEnv("SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, {
    auth: { persistSession: false },
    global: { headers: { "X-Client-Info": "gutenbergdoubleg-server" } },
  });
}

export function getStorageBucket() {
  return requireEnv("SUPABASE_STORAGE_BUCKET");
}
