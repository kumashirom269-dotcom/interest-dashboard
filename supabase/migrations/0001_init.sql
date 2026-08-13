-- 0001_init.sql
-- テーブル定義、check制約、updated_at自動更新、profiles自動作成トリガー

create extension if not exists pgcrypto;

-- ============================================================
-- profiles
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'auth.usersと1:1で対応するユーザープロフィール。idはauth.users.idと同一値。';

-- ============================================================
-- topics
-- ============================================================
create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- sources
-- ============================================================
create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  name text not null,
  url text not null,
  rss_url text,
  source_type text not null,
  status text not null default 'candidate',
  reason text,
  priority integer not null default 3,
  source_score integer not null default 0,
  created_by_ai boolean not null default true,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sources_source_type_check check (
    source_type in (
      'official_blog',
      'news_site',
      'rss',
      'tech_blog',
      'local_event_site',
      'youtube_channel',
      'research_site',
      'other'
    )
  ),
  constraint sources_status_check check (
    status in ('candidate', 'active', 'paused', 'rejected')
  ),
  constraint sources_priority_check check (priority between 1 and 5)
);

-- ============================================================
-- feed_items
-- ============================================================
create table if not exists public.feed_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  source_id uuid not null references public.sources(id) on delete cascade,
  title text not null,
  url text not null,
  source_name text not null,
  published_at timestamptz,
  raw_excerpt text,
  summary text,
  ai_comment text,
  relevance_score integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint feed_items_relevance_score_check check (
    relevance_score between 0 and 100
  ),
  constraint feed_items_user_url_unique unique (user_id, url)
);

-- ============================================================
-- reactions
-- ============================================================
create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  feed_item_id uuid not null references public.feed_items(id) on delete cascade,
  source_id uuid not null references public.sources(id) on delete cascade,
  reaction_type text not null,
  created_at timestamptz not null default now(),
  constraint reactions_reaction_type_check check (
    reaction_type in (
      'useful',
      'not_relevant',
      'save',
      'hide',
      'more_from_source',
      'less_from_source'
    )
  ),
  constraint reactions_user_feed_item_type_unique unique (
    user_id, feed_item_id, reaction_type
  )
);

-- ============================================================
-- source_score_logs
-- ============================================================
create table if not exists public.source_score_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_id uuid not null references public.sources(id) on delete cascade,
  feed_item_id uuid references public.feed_items(id) on delete set null,
  reaction_type text,
  score_delta integer not null,
  score_before integer not null,
  score_after integer not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- updated_at 自動更新
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at on public.profiles;
create trigger set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.topics;
create trigger set_updated_at
  before update on public.topics
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.sources;
create trigger set_updated_at
  before update on public.sources
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.feed_items;
create trigger set_updated_at
  before update on public.feed_items
  for each row execute function public.set_updated_at();

-- ============================================================
-- auth.users -> public.profiles 自動作成
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
