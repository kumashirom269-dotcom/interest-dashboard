-- 0030_debug_get_research_results_channel.sql
-- 0029_research_results_channel.sql で追加したresearch_results.channel列を
-- debug API（APIキー認証経路）からも確認できるようにする。
-- returns table の列構成が変わるため、CREATE OR REPLACEではなくDROP+CREATEが必要
-- （既存のdebug_get_*関数と同じパターン）。
-- 注意: このmigrationは0029より後に適用してください（channel列の存在が前提）。

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
    r.channel, r.created_at, r.updated_at
  from public.research_results r
  where r.user_id = public.debug_resolve_user_id(p_api_key_hash)
$$;

revoke all on function public.debug_get_research_results(text) from public;
grant execute on function public.debug_get_research_results(text) to anon, authenticated;
