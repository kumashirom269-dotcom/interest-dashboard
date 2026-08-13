-- 0024_debug_topics_classifications_freshness.sql
-- debug_get_topics / debug_get_topic_classifications（0013作成）の戻り値に、
-- その後のmigration（0020識別情報、0021鮮度プロファイル）で追加された列が
-- 含まれていなかったため、他のdebug_get_*関数と同様にDROP+CREATEで追従させる。
-- これにより、/api/debug/dashboard-summaryのトピック別サマリでfreshness_profile・
-- last_collected_atを参照できるようにする（既存データ・既存テーブルには影響しない）。

drop function if exists public.debug_get_topics(text);

create or replace function public.debug_get_topics(p_api_key_hash text)
returns table (
  id uuid,
  name text,
  description text,
  keywords text[],
  last_collected_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select t.id, t.name, t.description, t.keywords, t.last_collected_at, t.created_at, t.updated_at
  from public.topics t
  where t.user_id = public.debug_resolve_user_id(p_api_key_hash)
$$;

revoke all on function public.debug_get_topics(text) from public;
grant execute on function public.debug_get_topics(text) to anon, authenticated;

drop function if exists public.debug_get_topic_classifications(text);

create or replace function public.debug_get_topic_classifications(p_api_key_hash text)
returns table (
  topic_id uuid,
  topic_name text,
  entity_type text,
  parent_category text,
  sub_category text,
  detail_category text,
  summary text,
  intent_tags text[],
  recommended_source_types text[],
  search_keywords text[],
  confidence numeric,
  needs_user_confirmation boolean,
  ambiguity_reason text,
  candidate_entities jsonb,
  research_hints text[],
  notes text,
  identification_status text,
  canonical_url text,
  official_url text,
  youtube_channel_url text,
  freshness_profile text,
  freshness_reason text,
  min_refresh_interval_minutes integer,
  default_card_ttl_hours integer
)
language sql
security definer
set search_path = public
stable
as $$
  select
    c.topic_id, c.topic_name, c.entity_type, c.parent_category, c.sub_category,
    c.detail_category, c.summary, c.intent_tags, c.recommended_source_types,
    c.search_keywords, c.confidence, c.needs_user_confirmation, c.ambiguity_reason,
    c.candidate_entities, c.research_hints, c.notes,
    c.identification_status, c.canonical_url, c.official_url, c.youtube_channel_url,
    c.freshness_profile, c.freshness_reason, c.min_refresh_interval_minutes, c.default_card_ttl_hours
  from public.topic_classifications c
  where c.user_id = public.debug_resolve_user_id(p_api_key_hash)
$$;

revoke all on function public.debug_get_topic_classifications(text) from public;
grant execute on function public.debug_get_topic_classifications(text) to anon, authenticated;
