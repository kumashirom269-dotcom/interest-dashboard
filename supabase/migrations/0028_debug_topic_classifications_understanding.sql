-- 0028_debug_topic_classifications_understanding.sql
-- debug_get_topic_classifications（0013作成、0024・0026で追従済み）の戻り値に、
-- 0027で追加したTopicUnderstanding系列が含まれていなかったため追従させる。

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
  default_card_ttl_hours integer,
  time_intent text,
  time_intent_reason text,
  normalized_topic text,
  entity_name text,
  understanding_entity_type text,
  intent_category text,
  information_needs jsonb,
  priority_signals jsonb,
  negative_signals jsonb,
  search_hints jsonb,
  source_hints jsonb,
  audience_level text,
  location_required boolean,
  location_text text,
  ambiguity_is_ambiguous boolean,
  understanding_ambiguity_reason text,
  candidate_meanings jsonb,
  user_intent_summary text
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
    c.freshness_profile, c.freshness_reason, c.min_refresh_interval_minutes, c.default_card_ttl_hours,
    c.time_intent, c.time_intent_reason,
    c.normalized_topic, c.entity_name, c.understanding_entity_type, c.intent_category,
    c.information_needs, c.priority_signals, c.negative_signals, c.search_hints, c.source_hints,
    c.audience_level, c.location_required, c.location_text,
    c.ambiguity_is_ambiguous, c.understanding_ambiguity_reason, c.candidate_meanings,
    c.user_intent_summary
  from public.topic_classifications c
  where c.user_id = public.debug_resolve_user_id(p_api_key_hash)
$$;

revoke all on function public.debug_get_topic_classifications(text) from public;
grant execute on function public.debug_get_topic_classifications(text) to anon, authenticated;
