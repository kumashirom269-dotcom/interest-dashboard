-- 0002_rls.sql
-- Row Level Security の有効化とポリシー定義
-- 方針: 各ユーザーは自分の user_id と一致する行のみ select/insert/update/delete できる
--
-- 各CREATE POLICYは、SQL Editorで誤って再実行されてもエラーにならないよう、
-- pg_policiesで同名ポリシーの有無を確認してから作成するDO $$ ... $$ブロックで包んでいる
-- （既存ポリシーの内容・挙動は一切変更しない。既に存在する場合は何もしない）。

-- ============================================================
-- profiles
-- ============================================================
alter table public.profiles enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_select_own'
  ) then
    create policy "profiles_select_own"
      on public.profiles
      for select
      using (auth.uid() = id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_update_own'
  ) then
    create policy "profiles_update_own"
      on public.profiles
      for update
      using (auth.uid() = id)
      with check (auth.uid() = id);
  end if;
end $$;

-- insertは public.handle_new_user() トリガー（security definer）経由で行う想定のため、
-- クライアントからのinsertポリシーは意図的に用意しない。

-- ============================================================
-- topics
-- ============================================================
alter table public.topics enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'topics' and policyname = 'topics_select_own'
  ) then
    create policy "topics_select_own"
      on public.topics
      for select
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'topics' and policyname = 'topics_insert_own'
  ) then
    create policy "topics_insert_own"
      on public.topics
      for insert
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'topics' and policyname = 'topics_update_own'
  ) then
    create policy "topics_update_own"
      on public.topics
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'topics' and policyname = 'topics_delete_own'
  ) then
    create policy "topics_delete_own"
      on public.topics
      for delete
      using (auth.uid() = user_id);
  end if;
end $$;

-- ============================================================
-- sources
-- ============================================================
alter table public.sources enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'sources' and policyname = 'sources_select_own'
  ) then
    create policy "sources_select_own"
      on public.sources
      for select
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'sources' and policyname = 'sources_insert_own'
  ) then
    create policy "sources_insert_own"
      on public.sources
      for insert
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'sources' and policyname = 'sources_update_own'
  ) then
    create policy "sources_update_own"
      on public.sources
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'sources' and policyname = 'sources_delete_own'
  ) then
    create policy "sources_delete_own"
      on public.sources
      for delete
      using (auth.uid() = user_id);
  end if;
end $$;

-- ============================================================
-- feed_items
-- ============================================================
alter table public.feed_items enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'feed_items' and policyname = 'feed_items_select_own'
  ) then
    create policy "feed_items_select_own"
      on public.feed_items
      for select
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'feed_items' and policyname = 'feed_items_insert_own'
  ) then
    create policy "feed_items_insert_own"
      on public.feed_items
      for insert
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'feed_items' and policyname = 'feed_items_update_own'
  ) then
    create policy "feed_items_update_own"
      on public.feed_items
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'feed_items' and policyname = 'feed_items_delete_own'
  ) then
    create policy "feed_items_delete_own"
      on public.feed_items
      for delete
      using (auth.uid() = user_id);
  end if;
end $$;

-- ============================================================
-- reactions
-- ============================================================
alter table public.reactions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reactions' and policyname = 'reactions_select_own'
  ) then
    create policy "reactions_select_own"
      on public.reactions
      for select
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reactions' and policyname = 'reactions_insert_own'
  ) then
    create policy "reactions_insert_own"
      on public.reactions
      for insert
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reactions' and policyname = 'reactions_update_own'
  ) then
    create policy "reactions_update_own"
      on public.reactions
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reactions' and policyname = 'reactions_delete_own'
  ) then
    create policy "reactions_delete_own"
      on public.reactions
      for delete
      using (auth.uid() = user_id);
  end if;
end $$;

-- ============================================================
-- source_score_logs
-- ============================================================
alter table public.source_score_logs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'source_score_logs' and policyname = 'source_score_logs_select_own'
  ) then
    create policy "source_score_logs_select_own"
      on public.source_score_logs
      for select
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'source_score_logs' and policyname = 'source_score_logs_insert_own'
  ) then
    create policy "source_score_logs_insert_own"
      on public.source_score_logs
      for insert
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'source_score_logs' and policyname = 'source_score_logs_update_own'
  ) then
    create policy "source_score_logs_update_own"
      on public.source_score_logs
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'source_score_logs' and policyname = 'source_score_logs_delete_own'
  ) then
    create policy "source_score_logs_delete_own"
      on public.source_score_logs
      for delete
      using (auth.uid() = user_id);
  end if;
end $$;
