-- 0052_fix_get_public_antenna_cards_order.sql
-- 0051で作成したget_public_antenna()のバグ修正。
--
-- 推薦カード一覧を新しい順に並べる部分で、jsonb_build_object()の結果（スカラー値）
-- に対して誤って"c.created_at"という行参照の書き方をしていたため、
-- "missing FROM-clause entry for table \"c\""というSQLエラーで常に失敗していた
-- （実機検証で発覚）。サブクエリ側で別名を付けたcreated_at列をそのまま
-- order byに使うよう修正する（ロジック自体の変更は無い。構文ミスの修正のみ）。

drop function if exists public.get_public_antenna(text);

create or replace function public.get_public_antenna(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_topic record;
  v_result jsonb;
begin
  select id, user_id, public_title, name, public_description, description, published_at, updated_at
    into v_topic
    from public.topics
    where slug = p_slug and is_public = true
    limit 1;

  if not found then
    return null;
  end if;

  select jsonb_build_object(
    'id', v_topic.id,
    'title', coalesce(nullif(v_topic.public_title, ''), v_topic.name),
    'description', coalesce(nullif(v_topic.public_description, ''), v_topic.description, ''),
    'published_at', v_topic.published_at,
    'updated_at', v_topic.updated_at,
    'is_owner', (auth.uid() is not null and auth.uid() = v_topic.user_id),
    'is_following', (
      auth.uid() is not null and exists (
        select 1 from public.topic_follows
        where topic_id = v_topic.id and user_id = auth.uid()
      )
    ),
    'follower_count', (
      select count(*) from public.topic_follows where topic_id = v_topic.id
    ),
    'cards', (
      -- 修正点: c.created_at ではなく、サブクエリの列created_atをそのまま使う。
      select coalesce(jsonb_agg(c order by created_at desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'id', rc.id,
          'title', rc.generated_title,
          'summary', rc.generated_summary,
          'image_url', rc.image_url,
          'source_names', rc.source_names,
          'source_urls', rc.source_urls,
          'created_at', rc.created_at
        ) as c,
        rc.created_at as created_at
        from public.recommendation_cards rc
        where rc.topic_id = v_topic.id
        order by rc.created_at desc
        limit 30
      ) as cards_limited
    ),
    'sources', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'name', s.name,
        'url', s.url,
        'source_type', s.source_type
      )), '[]'::jsonb)
      from public.sources s
      where s.topic_id = v_topic.id and s.status = 'active'
    )
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.get_public_antenna(text) to anon, authenticated;

comment on function public.get_public_antenna(text) is
  '公開アンテナ(/a/[slug])向けの安全な読み取り専用関数。ホワイトリストした列のみを返し、既存テーブルのRLSやuser_id・内部スコア等は一切露出しない。';
