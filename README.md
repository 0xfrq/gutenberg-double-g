# Dogear

A soft, phone-first e-reader for free classics from Project Gutenberg and your
own EPUBs. Search the catalogue, keep books on shelves and in collections, and
read with your own theme, font, text size, and line spacing. Dogear remembers
your page.

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

## Reading

- Tap the left or right edge of the page to turn pages (arrow keys work too).
- Tap the middle of the page to show or hide the controls.
- **Aa** opens display settings: page color, text size, line spacing, font.
- The list icon opens the table of contents; the bottom slider scrubs through
  the book, and tapping the page number jumps to a page (or press `G`).

## Design

The brand and design tokens are documented in [`design.md`](design.md); the
tokens themselves live in `src/app/tokens.css`.

## Notes

- RapidAPI credentials are required for the Gutenberg proxy endpoints.
- The reader uses signed URLs for private storage access.
- Large EPUB uploads may hit serverless body size limits.
