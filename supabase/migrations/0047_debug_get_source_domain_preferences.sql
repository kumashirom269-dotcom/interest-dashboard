-- 0047_debug_get_source_domain_preferences.sql
-- source_domain_preferences（0046）をdebug APIのAPIキー認証経路から読み取れるようにする、
-- 読み取り専用SECURITY DEFINER関数。既存のdebug_get_*関数と同じパターン。

create or replace function public.debug_get_source_domain_preferences(p_api_key_hash text)
returns table (
  id uuid,
  topic_id uuid,
  source_domain text,
  source_name text,
  positive_score integer,
  negative_score integer,
  like_count integer,
  bad_count integer,
  hide_count integer,
  save_count integer,
  click_count integer,
  last_reaction_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.id, p.topic_id, p.source_domain, p.source_name,
    p.positive_score, p.negative_score,
    p.like_count, p.bad_count, p.hide_count, p.save_count, p.click_count,
    p.last_reaction_at, p.created_at, p.updated_at
  from public.source_domain_preferences p
  where p.user_id = public.debug_resolve_user_id(p_api_key_hash)
$$;

revoke all on function public.debug_get_source_domain_preferences(text) from public;
grant execute on function public.debug_get_source_domain_preferences(text) to anon, authenticated;
