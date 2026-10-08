-- ========================================================
-- 011_auth_only_schema.sql
-- Skema Database Minimal untuk Auth & Login Saja
-- Target: Supabase Postgres Baru (Project Ref: hvpgejmviabklfhrmdql)
-- Catatan: Data komik, chapter, dan genre tetap berada di Turso!
-- ========================================================

-- 1. Tabel PROFILES (Menyimpan data profil user dari Google Auth)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text,
  full_name text,
  avatar_url text,
  role text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS untuk profiles
alter table public.profiles enable row level security;

-- Policy RLS: Siapa saja boleh melihat profil publik
create policy "Public profiles are viewable by everyone"
  on public.profiles for select
  using (true);

-- Policy RLS: User hanya boleh mengedit profil miliknya sendiri
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Policy RLS: Insert profil diizinkan untuk service_role & trigger
create policy "Service role can manage profiles"
  on public.profiles for all
  using (true)
  with check (true);

-- 2. TRIGGER OTOMATIS: Saat user baru login via Google, otomatis buat baris di public.profiles
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    coalesce(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture',
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'
    )
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

-- Pasang Trigger pada tabel bawaan auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update on auth.users
  for each row execute function public.handle_new_user();

-- 3. Tabel Cadangan READING_HISTORY (Khusus jika Turso offline / fallback)
create table if not exists public.reading_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  comic_id text not null,
  chapter_id text not null,
  scroll_position numeric default 0,
  last_read_at timestamptz not null default now(),
  unique (user_id, comic_id, chapter_id)
);

alter table public.reading_history enable row level security;

create policy "Users can view and manage their own reading history"
  on public.reading_history for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Index agar pencarian riwayat user instan
create index if not exists idx_profiles_email on public.profiles(email);
create index if not exists idx_reading_history_user on public.reading_history(user_id, last_read_at desc);
