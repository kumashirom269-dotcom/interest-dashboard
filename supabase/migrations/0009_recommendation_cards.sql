-- 0009_recommendation_cards.sql
-- 「今日のおすすめ情報」表示用のカードテーブル。
-- 元記事（feed_items）そのものではなく、ユーザーの登録トピックに合わせて
-- AIが再構成したタイトル・要約・おすすめ理由・画像を保持する。
-- 複数のfeed_itemsが同じ話題を扱っている場合は、1件のカードにまとめる。

alter table public.feed_items
  add column if not exists image_url text;

create table if not exists public.recommendation_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  information_type text not null default 'other',
  generated_title text not null,
  generated_summary text not null,
  display_reason text not null,
  image_url text,
  image_alt text,
  image_source_type text not null default 'category_default',
  image_source_url text,
  source_feed_item_ids uuid[] not null default '{}',
  source_urls text[] not null default '{}',
  source_names text[] not null default '{}',
  click_score integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recommendation_cards_information_type_check check (
    information_type in (
      'tv_appearance',
      'event',
      'new_opening',
      'release',
      'movie',
      'music_news',
      'sns_trend',
      'local_news',
      'technology_update',
      'creator_post',
      'official_announcement',
      'sale_campaign',
      'travel_recommendation',
      'other'
    )
  )
);

create index if not exists idx_recommendation_cards_user_id
  on public.recommendation_cards (user_id);

create index if not exists idx_recommendation_cards_topic_id
  on public.recommendation_cards (topic_id);

-- ============================================================
-- updated_at 自動更新（既存のset_updated_at()トリガー関数を再利用）
-- ============================================================
drop trigger if exists set_updated_at on public.recommendation_cards;
create trigger set_updated_at
  before update on public.recommendation_cards
  for each row execute function public.set_updated_at();

-- ============================================================
-- RLS
-- ============================================================
alter table public.recommendation_cards enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'recommendation_cards' and policyname = 'recommendation_cards_select_own'
  ) then
    create policy "recommendation_cards_select_own"
      on public.recommendation_cards
      for select
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'recommendation_cards' and policyname = 'recommendation_cards_insert_own'
  ) then
    create policy "recommendation_cards_insert_own"
      on public.recommendation_cards
      for insert
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'recommendation_cards' and policyname = 'recommendation_cards_update_own'
  ) then
    create policy "recommendation_cards_update_own"
      on public.recommendation_cards
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'recommendation_cards' and policyname = 'recommendation_cards_delete_own'
  ) then
    create policy "recommendation_cards_delete_own"
      on public.recommendation_cards
      for delete
      using (auth.uid() = user_id);
  end if;
end $$;
