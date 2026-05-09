# DoubleG Reader

Kindle-like personal library for Project Gutenberg books with Supabase storage,
collections, favorites, and a customizable reader.

## Setup

1. Copy `.env.example` to `.env.local` and fill in the values.
2. Run the SQL in `supabase/schema.sql` using the Supabase SQL editor.
3. Create a private Supabase storage bucket named `gutenberg` (or update
	`SUPABASE_STORAGE_BUCKET`).

## Development

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

## Notes

- RapidAPI credentials are required for the Gutenberg proxy endpoints.
- The reader uses signed URLs for private storage access.
- Large EPUB uploads may hit serverless body size limits.
