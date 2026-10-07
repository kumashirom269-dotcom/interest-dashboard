-- 0051_public_antenna.sql
-- Antenna 2.0 第1フェーズ: トピック（アンテナ）の公開・フォロー・コピー機能の
-- データベース基盤。
--
-- 方針: 既存のuser_idベースRLS（0002_rls.sql）は一切変更しない。
-- 公開データの読み取りは、anonへテーブルを直接開放するRLSポリシーを追加するのでは
-- なく、ホワイトリストした列だけを返すsecurity definer関数（get_public_antenna）
-- 経由に限定する（lib/debug-api/が使っているsecurity definer関数のパターンを踏襲）。
-- これにより、既存の非公開トピックの安全性（user_id・内部AI判定データ・raw content・
-- 内部スコア・デバッグ用情報が外部に漏れないこと）を一切変更せずに済む。

-- ============================================================
-- 1. topics: 公開関連カラムの追加
-- ============================================================
-- すべてnullable or default付きで追加するため、既存データは非破壊。
-- is_publicはdefault falseのため、既存トピックは移行後も自動的に非公開のまま。
alter table public.topics
  add column if not exists is_public boolean not null default false,
  add column if not exists slug text,
  add column if not exists public_title text,
  add column if not exists public_description text,
  add column if not exists published_at timestamptz,
  add column if not exists copied_from_topic_id uuid references public.topics(id) on delete set null;

create unique index if not exists idx_topics_slug
  on public.topics (slug)
  where slug is not null;

create index if not exists idx_topics_is_public
  on public.topics (is_public)
  where is_public = true;

comment on column public.topics.is_public is '公開アンテナとして/a/[slug]から閲覧可能かどうか。既存トピックは全てfalse。';
comment on column public.topics.slug is '公開URL(/a/[slug])用の推測不可なランダム文字列。非公開の間はnullでよい。';
comment on column public.topics.copied_from_topic_id is '公開アンテナからコピーして作成された場合の、コピー元topics.id。コピー元が削除されたらnullに戻す。';

-- ============================================================
-- 2. topic_follows: フォロー関係
-- ============================================================
-- 1アンテナ + 多数のfollowersという構造（フォロワーごとに独立したAI収集は行わない）。
-- 個々のフォロワーの一覧は、オーナー本人を含め誰にも見せない方針のため、
-- selectポリシーもauth.uid() = user_id（＝自分がフォローしているものの一覧のみ）に限定する。
-- フォロワー"数"の表示は、下記get_public_antenna()内のcount集計のみで行う。
create table if not exists public.topic_follows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint topic_follows_user_topic_unique unique (user_id, topic_id)
);

create index if not exists idx_topic_follows_topic_id
  on public.topic_follows (topic_id);

create index if not exists idx_topic_follows_user_id
  on public.topic_follows (user_id);

alter table public.topic_follows enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'topic_follows' and policyname = 'topic_follows_select_own'
  ) then
    create policy "topic_follows_select_own"
      on public.topic_follows
      for select
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'topic_follows' and policyname = 'topic_follows_insert_own'
  ) then
    create policy "topic_follows_insert_own"
      on public.topic_follows
      for insert
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'topic_follows' and policyname = 'topic_follows_delete_own'
  ) then
    create policy "topic_follows_delete_own"
      on public.topic_follows
      for delete
      using (auth.uid() = user_id);
  end if;
end $$;

-- ============================================================
-- 3. get_public_antenna: 公開アンテナの安全な読み取り専用関数
-- ============================================================
-- is_public = trueのtopicのみを対象に、ホワイトリストした列だけをjsonbで返す。
-- user_id・内部AI判定データ（topic_classifications等）・raw content・内部スコア
-- （source_reliability_score, click_score等）・デバッグ用情報は一切含めない。
-- anon（未ログイン）・authenticated両方のロールから呼べるようにする。
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
    -- user_idそのものは返さず、呼び出し元(auth.uid())との比較結果のみを返す。
    -- security definerで内部的にuser_idへアクセスできることと、それを外部へ
    -- 露出することは別の話であるため、計算済みのbooleanのみに限定する。
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
      select coalesce(jsonb_agg(c order by c.created_at desc), '[]'::jsonb)
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
        rc.created_at
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

-- ============================================================
-- 4. list_recent_public_antennas: トップページ導線用の一覧
-- ============================================================
-- 指示書12章「公開アンテナへ自然に到達できる導線」の最小実装。
-- 人気順・検索・カテゴリ別等は第1フェーズでは実装しない（指示書16章）ため、
-- 公開日時の新しい順に数件返すだけの、同じくホワイトリスト方式の関数。
drop function if exists public.list_recent_public_antennas(integer);

create or replace function public.list_recent_public_antennas(p_limit integer default 6)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(t), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'title', coalesce(nullif(public_title, ''), name),
      'description', coalesce(nullif(public_description, ''), description, ''),
      'slug', slug
    ) as t
    from public.topics
    where is_public = true and slug is not null
    order by published_at desc nulls last
    limit greatest(p_limit, 0)
  ) as recent;
$$;

grant execute on function public.list_recent_public_antennas(integer) to anon, authenticated;

comment on function public.list_recent_public_antennas(integer) is
  'トップページの「公開アンテナを見る」導線用。公開日時の新しい順にタイトル・説明・slugのみを返す。';
