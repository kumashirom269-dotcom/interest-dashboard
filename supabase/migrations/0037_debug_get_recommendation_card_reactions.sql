-- 0037_debug_get_recommendation_card_reactions.sql
-- recommendation_card_reactions（0036）をdebug APIのAPIキー認証経路から
-- 読み取れるようにする、読み取り専用SECURITY DEFINER関数。
-- 既存のdebug_get_*関数と同じパターン（insert/update/deleteは実装しない、user_idは返さない）。

create or replace function public.debug_get_recommendation_card_reactions(p_api_key_hash text)
returns table (
  id uuid,
  recommendation_card_id uuid,
  topic_id uuid,
  reaction_type text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select r.id, r.recommendation_card_id, r.topic_id, r.reaction_type, r.created_at, r.updated_at
  from public.recommendation_card_reactions r
  where r.user_id = public.debug_resolve_user_id(p_api_key_hash)
$$;

revoke all on function public.debug_get_recommendation_card_reactions(text) from public;
grant execute on function public.debug_get_recommendation_card_reactions(text) to anon, authenticated;
