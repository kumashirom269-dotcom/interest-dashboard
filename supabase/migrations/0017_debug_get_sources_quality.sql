-- 0017_debug_get_sources_quality.sql
-- debug_get_sources関数（0013作成、0015でfetch_status系カラムを追加）の戻り値に、
-- 0016で追加したsource品質管理カラムを追加する。
-- source_type/fetch_method/fetch_status/last_fetch_error_type/last_fetch_error_messageは
-- 0015で既に追加済みのためそのまま維持する。
-- 戻り値の列構成変更のため、一度DROPしてから再作成する（実行権限は再作成後に明示的に再付与する。
-- 既存データ・既存のsources/topicsテーブルには一切手を加えない）。

drop function if exists public.debug_get_sources(text);

create or replace function public.debug_get_sources(p_api_key_hash text)
returns table (
  id uuid,
  user_id uuid,
  topic_id uuid,
  name text,
  url text,
  rss_url text,
  source_type text,
  status text,
  reason text,
  priority integer,
  source_score integer,
  created_by_ai boolean,
  last_checked_at timestamptz,
  fetch_method text,
  fetch_status text,
  last_fetch_error_type text,
  last_fetch_error_message text,
  last_fetch_attempt_at timestamptz,
  last_successful_fetch_at timestamptz,
  is_official boolean,
  is_specific_source boolean,
  is_search_seed boolean,
  source_reliability_score integer,
  topic_relevance_score integer,
  needs_review boolean,
  review_reason text,
  created_at timestamptz,
  updated_at timestamptz,
  topics jsonb
)
language sql
security definer
set search_path = public
stable
as $$
  select
    s.id, s.user_id, s.topic_id, s.name, s.url, s.rss_url, s.source_type, s.status,
    s.reason, s.priority, s.source_score, s.created_by_ai, s.last_checked_at,
    s.fetch_method, s.fetch_status, s.last_fetch_error_type, s.last_fetch_error_message,
    s.last_fetch_attempt_at, s.last_successful_fetch_at,
    s.is_official, s.is_specific_source, s.is_search_seed,
    s.source_reliability_score, s.topic_relevance_score,
    s.needs_review, s.review_reason,
    s.created_at, s.updated_at,
    case when t.name is null then null else jsonb_build_object('name', t.name) end as topics
  from public.sources s
  left join public.topics t on t.id = s.topic_id
  where s.user_id = public.debug_resolve_user_id(p_api_key_hash)
$$;

revoke all on function public.debug_get_sources(text) from public;
grant execute on function public.debug_get_sources(text) to anon, authenticated;
