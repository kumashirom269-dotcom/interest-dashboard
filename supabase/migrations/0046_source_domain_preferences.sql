-- 0046_source_domain_preferences.sql
-- レビュー指摘#4対応。research_results由来カードへのリアクションは、既存sourcesテーブルに
-- 完全一致するドメインが無いと何も学習に反映されない問題があった（実機検証で確認）。
-- sourcesの完全一致有無によらず、ユーザー・トピック・sourceDomain単位でリアクション集計を
-- 保存する新テーブルを追加する。既存sources.source_scoreの更新（完全一致時のみ）は維持し、
-- こちらは並行して常に更新する。

create table if not exists public.source_domain_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  source_domain text not null,
  source_name text,
  positive_score integer not null default 0,
  negative_score integer not null default 0,
  like_count integer not null default 0,
  bad_count integer not null default 0,
  hide_count integer not null default 0,
  save_count integer not null default 0,
  click_count integer not null default 0,
  last_reaction_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint source_domain_preferences_unique unique (user_id, topic_id, source_domain)
);

create index if not exists idx_source_domain_preferences_topic_id
  on public.source_domain_preferences (topic_id);

drop trigger if exists set_updated_at on public.source_domain_preferences;
create trigger set_updated_at
  before update on public.source_domain_preferences
  for each row execute function public.set_updated_at();

alter table public.source_domain_preferences enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'source_domain_preferences' and policyname = 'source_domain_preferences_select_own'
  ) then
    create policy "source_domain_preferences_select_own"
      on public.source_domain_preferences
      for select
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'source_domain_preferences' and policyname = 'source_domain_preferences_insert_own'
  ) then
    create policy "source_domain_preferences_insert_own"
      on public.source_domain_preferences
      for insert
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'source_domain_preferences' and policyname = 'source_domain_preferences_update_own'
  ) then
    create policy "source_domain_preferences_update_own"
      on public.source_domain_preferences
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'source_domain_preferences' and policyname = 'source_domain_preferences_delete_own'
  ) then
    create policy "source_domain_preferences_delete_own"
      on public.source_domain_preferences
      for delete
      using (auth.uid() = user_id);
  end if;
end $$;
