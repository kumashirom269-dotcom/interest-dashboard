-- 0015_debug_get_sources_fetch_status.sql
-- debug_get_sources関数（0013で作成）の戻り値に、0014で追加した
-- fetch_method/fetch_status/last_fetch_*カラムが含まれていなかったため追加する。
-- 戻り値の列構成を変更するにはPostgresの制約上、一度DROPしてから再作成する必要がある
-- （実行権限は再作成後に明示的に再付与する。既存データ・既存のsources/topicsテーブルには
-- 一切手を加えない）。

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
    s.created_at, s.updated_at,
    case when t.name is null then null else jsonb_build_object('name', t.name) end as topics
  from public.sources s
  left join public.topics t on t.id = s.topic_id
  where s.user_id = public.debug_resolve_user_id(p_api_key_hash)
$$;

revoke all on function public.debug_get_sources(text) from public;
grant execute on function public.debug_get_sources(text) to anon, authenticated;
