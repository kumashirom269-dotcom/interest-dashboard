-- 0011_topic_preferences.sql
-- トピックごとに「AIにどう情報を選んでほしいか」の好み設定を保存するテーブル。
-- topic_classifications（AIが推定した情報）と対になる、ユーザー指定の好み設定。
-- 初回実装では1トピックにつき1件のみ保持する（履歴・複数プロファイルは将来検討）。

create table if not exists public.topic_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  target_level text not null default 'intermediate',
  desired_content_types text[] not null default '{}',
  display_tone text not null default 'practical',
  excluded_tendencies text[] not null default '{}',
  supplementary_notes text,
  user_focus text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint topic_preferences_target_level_check check (
    target_level in ('beginner', 'intermediate', 'advanced')
  ),
  constraint topic_preferences_display_tone_check check (
    display_tone in ('easy', 'practical', 'deep', 'casual')
  ),
  constraint topic_preferences_topic_id_unique unique (topic_id)
);

create index if not exists idx_topic_preferences_user_id
  on public.topic_preferences (user_id);

-- ============================================================
-- updated_at 自動更新（既存のset_updated_at()トリガー関数を再利用）
-- ============================================================
drop trigger if exists set_updated_at on public.topic_preferences;
create trigger set_updated_at
  before update on public.topic_preferences
  for each row execute function public.set_updated_at();

-- ============================================================
-- RLS
-- ============================================================
alter table public.topic_preferences enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'topic_preferences' and policyname = 'topic_preferences_select_own'
  ) then
    create policy "topic_preferences_select_own"
      on public.topic_preferences
      for select
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'topic_preferences' and policyname = 'topic_preferences_insert_own'
  ) then
    create policy "topic_preferences_insert_own"
      on public.topic_preferences
      for insert
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'topic_preferences' and policyname = 'topic_preferences_update_own'
  ) then
    create policy "topic_preferences_update_own"
      on public.topic_preferences
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'topic_preferences' and policyname = 'topic_preferences_delete_own'
  ) then
    create policy "topic_preferences_delete_own"
      on public.topic_preferences
      for delete
      using (auth.uid() = user_id);
  end if;
end $$;
