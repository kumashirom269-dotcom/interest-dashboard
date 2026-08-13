-- 0023_debug_get_research_results.sql
-- debug API（/api/debug/research-results）のAPIキー認証経路用SECURITY DEFINER関数。
-- 既存のdebug_get_*関数（0013_debug_api_access.sql）と同じパターンで、
-- APIキーのハッシュをdebug_api_configと照合し、該当ユーザーのresearch_resultsのみ返す。

create or replace function public.debug_get_research_results(p_api_key_hash text)
returns table (
  id uuid,
  topic_id uuid,
  query text,
  provider text,
  result_type text,
  title text,
  url text,
  snippet text,
  source_name text,
  source_domain text,
  author_name text,
  published_at timestamptz,
  discovered_at timestamptz,
  ranking_position integer,
  popularity_score integer,
  credibility_score integer,
  relevance_score integer,
  freshness_score integer,
  image_url text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    r.id, r.topic_id, r.query, r.provider, r.result_type, r.title, r.url,
    r.snippet, r.source_name, r.source_domain, r.author_name,
    r.published_at, r.discovered_at, r.ranking_position, r.popularity_score,
    r.credibility_score, r.relevance_score, r.freshness_score, r.image_url,
    r.created_at, r.updated_at
  from public.research_results r
  where r.user_id = public.debug_resolve_user_id(p_api_key_hash)
$$;

revoke all on function public.debug_get_research_results(text) from public;
grant execute on function public.debug_get_research_results(text) to anon, authenticated;

-- 0022_research_results.sqlのsource_research_result_ids追加、および
-- 検索拡張型リサーチ収集の可視化に合わせて、recommendation_cardsもdebug APIから
-- 確認できるようにする（/api/debug/recommendation-cards、dashboard-summaryの
-- トピック別サマリで使用）。
create or replace function public.debug_get_recommendation_cards(p_api_key_hash text)
returns table (
  id uuid,
  topic_id uuid,
  information_type text,
  generated_title text,
  generated_summary text,
  display_reason text,
  image_url text,
  source_feed_item_ids uuid[],
  source_research_result_ids uuid[],
  source_urls text[],
  source_names text[],
  click_score integer,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    c.id, c.topic_id, c.information_type, c.generated_title, c.generated_summary,
    c.display_reason, c.image_url, c.source_feed_item_ids, c.source_research_result_ids,
    c.source_urls, c.source_names, c.click_score, c.created_at, c.updated_at
  from public.recommendation_cards c
  where c.user_id = public.debug_resolve_user_id(p_api_key_hash)
$$;

revoke all on function public.debug_get_recommendation_cards(text) from public;
grant execute on function public.debug_get_recommendation_cards(text) to anon, authenticated;
