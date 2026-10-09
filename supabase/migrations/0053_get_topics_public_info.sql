-- 0053_get_topics_public_info.sql
-- フォロー中のアンテナ一覧（getFollowedTopicsForUser）が空になる不具合の修正。
--
-- topic_follows自体は自分の行として正しく読めるが、そこに埋め込みjoinしていた
-- topics(...)は、フォロー先が他人のトピックである場合、既存のRLS
-- （topics_select_own = auth.uid() = user_id）により常にnullになり、一覧が
-- 常に空になっていた（実機検証で発覚。「フォロー数には反映されるのに
-- 一覧には出てこない」という症状から判明）。
--
-- get_public_antenna()と同じホワイトリスト方針の、複数id版の読み取り専用関数を
-- 追加し、topic_followsのtopic_id一覧をこちら経由で解決する形に変更する。
-- 既存テーブルのRLSは一切変更しない。

drop function if exists public.get_topics_public_info(uuid[]);

create or replace function public.get_topics_public_info(p_topic_ids uuid[])
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'title', coalesce(nullif(public_title, ''), name),
    'description', coalesce(nullif(public_description, ''), description, ''),
    'slug', slug
  )), '[]'::jsonb)
  from public.topics
  where id = any(p_topic_ids) and is_public = true;
$$;

grant execute on function public.get_topics_public_info(uuid[]) to authenticated;

comment on function public.get_topics_public_info(uuid[]) is
  'フォロー中アンテナ一覧表示用。指定idのうちis_public=trueのものだけ、ホワイトリストした列のみを返す。非公開化・削除されたフォロー先は結果に含まれない。';
