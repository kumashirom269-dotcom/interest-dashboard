-- 0034_debug_get_research_results_extended.sql
-- 0032_research_results_plan_link.sql で追加した列（research_plan_id・is_follow_up・
-- follow_up_reason・fetched_page_title・fetched_page_description・fetched_image_url・
-- fetch_status）をdebug API（APIキー認証経路）からも確認できるようにする。
-- returns table の列構成が変わるため、CREATE OR REPLACEではなくDROP+CREATEが必要。
-- 注意: このmigrationは0032より後に適用してください（対象列の存在が前提）。

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
    r.channel, r.research_plan_id, r.is_follow_up, r.follow_up_reason,
    r.fetched_page_title, r.fetched_page_description, r.fetched_image_url, r.fetch_status,
    r.created_at, r.updated_at
  from public.research_results r
  where r.user_id = public.debug_resolve_user_id(p_api_key_hash)
$$;

revoke all on function public.debug_get_research_results(text) from public;
grant execute on function public.debug_get_research_results(text) to anon, authenticated;
