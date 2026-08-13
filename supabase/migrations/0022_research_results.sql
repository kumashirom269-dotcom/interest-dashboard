-- 0022_research_results.sql
-- 検索拡張型リサーチ収集（research-based collection）の保存先。
-- sourcesとの役割分担:
--   sources          … 公式サイト・RSSなど、継続的に監視する価値がある情報源
--   research_results … その時点の検索・調査（検索API・ニュースAPI・将来のSNS/YouTube API等）
--                       で見つかった個別の記事・投稿・動画。一時的〜半永続的な調査結果
--
-- recommendation_cardsは、feed_items（RSS由来）とresearch_results（検索由来）の
-- 両方を参照できるようにするため、source_research_result_idsを追加する
-- （既存のsource_feed_item_idsはそのまま維持。破壊的変更なし）。

create table if not exists public.research_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,

  query text not null,
  provider text not null,
  result_type text not null,

  title text not null,
  url text not null,
  snippet text,
  source_name text,
  source_domain text,
  author_name text,

  published_at timestamptz,
  discovered_at timestamptz not null default now(),

  ranking_position integer,
  popularity_score integer,
  credibility_score integer,
  relevance_score integer,
  freshness_score integer,

  image_url text,
  raw_metadata jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint research_results_provider_check check (
    provider in ('mock', 'web_search', 'news_search', 'youtube', 'social')
  ),
  constraint research_results_result_type_check check (
    result_type in (
      'web_article', 'news_article', 'youtube_video', 'sns_post',
      'official_page', 'blog', 'other'
    )
  ),
  constraint research_results_popularity_score_check
    check (popularity_score is null or popularity_score between 0 and 100),
  constraint research_results_credibility_score_check
    check (credibility_score is null or credibility_score between 0 and 100),
  constraint research_results_relevance_score_check
    check (relevance_score is null or relevance_score between 0 and 100),
  constraint research_results_freshness_score_check
    check (freshness_score is null or freshness_score between 0 and 100),
  -- 同じトピック・同じURLの重複保存を防ぐ（検索クエリを変えて再実行しても同じ記事なら1件に集約する）
  constraint research_results_topic_url_unique unique (topic_id, url)
);

create index if not exists idx_research_results_user_id
  on public.research_results (user_id);
create index if not exists idx_research_results_topic_id
  on public.research_results (topic_id);

drop trigger if exists set_updated_at on public.research_results;
create trigger set_updated_at
  before update on public.research_results
  for each row execute function public.set_updated_at();

alter table public.research_results enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'research_results' and policyname = 'research_results_select_own'
  ) then
    create policy "research_results_select_own"
      on public.research_results
      for select
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'research_results' and policyname = 'research_results_insert_own'
  ) then
    create policy "research_results_insert_own"
      on public.research_results
      for insert
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'research_results' and policyname = 'research_results_update_own'
  ) then
    create policy "research_results_update_own"
      on public.research_results
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'research_results' and policyname = 'research_results_delete_own'
  ) then
    create policy "research_results_delete_own"
      on public.research_results
      for delete
      using (auth.uid() = user_id);
  end if;
end $$;

-- recommendation_cardsからresearch_resultsを参照できるようにする（追加のみ）
alter table public.recommendation_cards
  add column if not exists source_research_result_ids uuid[] not null default '{}';
