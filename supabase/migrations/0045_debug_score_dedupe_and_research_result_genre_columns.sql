-- 0045_debug_score_dedupe_and_research_result_genre_columns.sql
-- 0044で追加した列をdebug API（APIキー認証経路）からも確認できるようにする。
-- returns tableの列構成が変わるため、CREATE OR REPLACEではなくDROP+CREATEが必要。

drop function if exists public.debug_get_recommendation_cards(text);

create function public.debug_get_recommendation_cards(p_api_key_hash text)
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
  updated_at timestamptz,
  genre_id text,
  information_types jsonb,
  cross_genre_tags jsonb,
  risk_level text,
  freshness_level text,
  warnings jsonb,
  information_value_score numeric,
  score_breakdown jsonb,
  dedupe_key text,
  entity_name text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    c.id, c.topic_id, c.information_type, c.generated_title, c.generated_summary,
    c.display_reason, c.image_url, c.source_feed_item_ids, c.source_research_result_ids,
    c.source_urls, c.source_names, c.click_score, c.created_at, c.updated_at,
    c.genre_id, c.information_types, c.cross_genre_tags, c.risk_level, c.freshness_level, c.warnings,
    c.information_value_score, c.score_breakdown, c.dedupe_key, c.entity_name
  from public.recommendation_cards c
  where c.user_id = public.debug_resolve_user_id(p_api_key_hash)
$$;

revoke all on function public.debug_get_recommendation_cards(text) from public;
grant execute on function public.debug_get_recommendation_cards(text) to anon, authenticated;

drop function if exists public.debug_get_research_results(text);

create function public.debug_get_research_results(p_api_key_hash text)
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
  channel text,
  research_plan_id uuid,
  is_follow_up boolean,
  follow_up_reason text,
  fetched_page_title text,
  fetched_page_description text,
  fetched_image_url text,
  fetch_status text,
  created_at timestamptz,
  updated_at timestamptz,
  genre_id text,
  information_types jsonb,
  cross_genre_tags jsonb,
  risk_level text,
  source_tier smallint,
  requires_verification boolean,
  verification_issues jsonb,
  temporal_status text
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
    r.channel, r.research_plan_id, r.is_follow_up, r.follow_up_reason,
    r.fetched_page_title, r.fetched_page_description, r.fetched_image_url, r.fetch_status,
    r.created_at, r.updated_at,
    r.genre_id, r.information_types, r.cross_genre_tags, r.risk_level, r.source_tier,
    r.requires_verification, r.verification_issues, r.temporal_status
  from public.research_results r
  where r.user_id = public.debug_resolve_user_id(p_api_key_hash)
$$;

revoke all on function public.debug_get_research_results(text) from public;
grant execute on function public.debug_get_research_results(text) to anon, authenticated;
