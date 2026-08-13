-- 0008_topic_classifications.sql
-- トピックのAI分類結果を保存するテーブル。
-- 初回実装では履歴は持たず、1トピックにつき最新の分類結果を1件だけ保持する。

create table if not exists public.topic_classifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  topic_name text not null,
  entity_type text not null,
  parent_category text not null,
  sub_category text not null,
  detail_category text not null,
  summary text,
  intent_tags text[] not null default '{}',
  recommended_source_types text[] not null default '{}',
  search_keywords text[] not null default '{}',
  confidence numeric not null,
  needs_user_confirmation boolean not null default false,
  notes text,
  raw_result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint topic_classifications_confidence_check
    check (confidence >= 0 and confidence <= 1),
  constraint topic_classifications_topic_id_unique unique (topic_id)
);

create index if not exists idx_topic_classifications_user_id
  on public.topic_classifications (user_id);

-- ============================================================
-- updated_at 自動更新（既存のset_updated_at()トリガー関数を再利用）
-- ============================================================
drop trigger if exists set_updated_at on public.topic_classifications;
create trigger set_updated_at
  before update on public.topic_classifications
  for each row execute function public.set_updated_at();

-- ============================================================
-- RLS
-- ============================================================
alter table public.topic_classifications enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'topic_classifications' and policyname = 'topic_classifications_select_own'
  ) then
    create policy "topic_classifications_select_own"
      on public.topic_classifications
      for select
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'topic_classifications' and policyname = 'topic_classifications_insert_own'
  ) then
    create policy "topic_classifications_insert_own"
      on public.topic_classifications
      for insert
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'topic_classifications' and policyname = 'topic_classifications_update_own'
  ) then
    create policy "topic_classifications_update_own"
      on public.topic_classifications
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'topic_classifications' and policyname = 'topic_classifications_delete_own'
  ) then
    create policy "topic_classifications_delete_own"
      on public.topic_classifications
      for delete
      using (auth.uid() = user_id);
  end if;
end $$;
