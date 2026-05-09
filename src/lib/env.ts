export const env = {
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_STORAGE_BUCKET: process.env.SUPABASE_STORAGE_BUCKET,
  RAPIDAPI_HOST:
    process.env.RAPIDAPI_HOST ||
    "project-gutenberg-free-books-api1.p.rapidapi.com",
  RAPIDAPI_KEY: process.env.RAPIDAPI_KEY,
};

export function requireEnv(key: keyof typeof env): string {
  const value = env[key];
  if (!value) {
    throw new Error(`Missing env: ${key}`);
  }
  return value;
}
