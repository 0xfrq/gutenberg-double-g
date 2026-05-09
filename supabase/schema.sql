create extension if not exists "pgcrypto";

create table if not exists public.book_cache (
  id bigint primary key,
  title text not null,
  alternative_title text,
  authors jsonb,
  authors_text text,
  subjects text[],
  subjects_text text,
  bookshelves text[],
  bookshelves_text text,
  summary text,
  cover_image text,
  formats jsonb,
  epub_url text,
  epub_path text,
  download_count integer,
  issued timestamptz,
  reading_ease_score numeric,
  cached_at timestamptz not null default now()
);

create table if not exists public.uploads (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  file_path text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.shelf_items (
  id uuid primary key default gen_random_uuid(),
  shelf text not null,
  source text not null,
  item_id text not null,
  created_at timestamptz not null default now(),
  unique (shelf, source, item_id)
);

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  item_id text not null,
  created_at timestamptz not null default now(),
  unique (source, item_id)
);

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.collection_items (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections(id) on delete cascade,
  source text not null,
  item_id text not null,
  created_at timestamptz not null default now(),
  unique (collection_id, source, item_id)
);

alter table public.book_cache disable row level security;
alter table public.uploads disable row level security;
alter table public.shelf_items disable row level security;
alter table public.favorites disable row level security;
alter table public.collections disable row level security;
alter table public.collection_items disable row level security;
