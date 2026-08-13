-- 0035_debug_research_plans_and_vetting_rpcs.sql
-- research_plans（0031）・research_vetting_results（0033）をdebug APIの
-- APIキー認証経路から読み取れるようにする、読み取り専用SECURITY DEFINER関数。
-- 既存のdebug_get_*関数と同じパターン（insert/update/deleteは実装しない）。

create or replace function public.debug_get_research_plans(p_api_key_hash text)
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
  created_at timestamptz
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
    p.expected_result_types, p.notes_for_vetting, p.raw_plan, p.created_at
  from public.research_plans p
  where p.user_id = public.debug_resolve_user_id(p_api_key_hash)
$$;

create or replace function public.debug_get_research_vetting_results(p_api_key_hash text)
returns table (
  id uuid,
  topic_id uuid,
  research_plan_id uuid,
  cluster_key text,
  judgement text,
  exclude_reason text,
  reason text,
  matched_positive_signals jsonb,
  matched_negative_signals jsonb,
  representative_title text,
  representative_url text,
  candidate_count integer,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    v.id, v.topic_id, v.research_plan_id, v.cluster_key, v.judgement, v.exclude_reason,
    v.reason, v.matched_positive_signals, v.matched_negative_signals,
    v.representative_title, v.representative_url, v.candidate_count, v.created_at
  from public.research_vetting_results v
  where v.user_id = public.debug_resolve_user_id(p_api_key_hash)
$$;

revoke all on function public.debug_get_research_plans(text) from public;
revoke all on function public.debug_get_research_vetting_results(text) from public;

grant execute on function public.debug_get_research_plans(text) to anon, authenticated;
grant execute on function public.debug_get_research_vetting_results(text) to anon, authenticated;
