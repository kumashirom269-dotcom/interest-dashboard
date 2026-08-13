-- 0043_debug_research_plans_and_cards_genre_columns.sql
-- 0042で追加した列をdebug API（APIキー認証経路）からも確認できるようにする。
-- returns tableの列構成が変わるため、CREATE OR REPLACEではなくDROP+CREATEが必要。

drop function if exists public.debug_get_research_plans(text);

create function public.debug_get_research_plans(p_api_key_hash text)
returns table (
  id uuid,
  topic_id uuid,
  topic_name text,
  primary_goal text,
  preferred_channels jsonb,
  search_queries jsonb,
  official_site_queries jsonb,
  event_queries jsonb,
  exclusion_queries jsonb,
  must_include_signals jsonb,
  must_exclude_signals jsonb,
  source_priority jsonb,
  freshness_policy jsonb,
  expected_result_types jsonb,
  notes_for_vetting text,
  raw_plan jsonb,
  created_at timestamptz,
  primary_genre_id text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.id, p.topic_id, p.topic_name, p.primary_goal, p.preferred_channels,
    p.search_queries, p.official_site_queries, p.event_queries, p.exclusion_queries,
    p.must_include_signals, p.must_exclude_signals, p.source_priority, p.freshness_policy,
    p.expected_result_types, p.notes_for_vetting, p.raw_plan, p.created_at, p.primary_genre_id
  from public.research_plans p
  where p.user_id = public.debug_resolve_user_id(p_api_key_hash)
$$;

revoke all on function public.debug_get_research_plans(text) from public;
grant execute on function public.debug_get_research_plans(text) to anon, authenticated;

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
  warnings jsonb
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
    c.genre_id, c.information_types, c.cross_genre_tags, c.risk_level, c.freshness_level, c.warnings
  from public.recommendation_cards c
  where c.user_id = public.debug_resolve_user_id(p_api_key_hash)
$$;

revoke all on function public.debug_get_recommendation_cards(text) from public;
grant execute on function public.debug_get_recommendation_cards(text) to anon, authenticated;
