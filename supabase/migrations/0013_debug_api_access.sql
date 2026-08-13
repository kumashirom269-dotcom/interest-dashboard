-- 0013_debug_api_access.sql
-- 【設計変更】alter database set によるPostgresカスタム設定は、Supabase SQL Editorの実行権限では
-- 使用できない（ERROR 42501: permission denied to set parameter）ため、この方式は廃止する。
--
-- 新しい設計:
-- 1. APIキーの生値の照合はNext.js側のRoute Handler（.env.localのDEBUG_API_KEY）で行う
-- 2. DB側は、APIキーのSHA-256ハッシュだけを保存する専用テーブル debug_api_config を持ち、
--    一般ユーザー（anon/authenticated）からは一切select/insert/update/deleteできないようにする
-- 3. データの読み取りは、渡されたハッシュがdebug_api_configの値と一致した場合のみ
--    対応するuser_idの行を返す、読み取り専用のSECURITY DEFINER関数（RPC）でのみ行う
--    （insert/update/deleteは一切実装しない）
--
-- 既存のtopics/sources/feed_items/topic_classifications/reactionsのRLSポリシー・
-- 通常画面（Cookieログイン経由）のアクセス経路には一切手を加えない。

-- 1. 前回試みたRLSポリシーの後片付け（存在しなければ何もしない。alter database未設定のため
--    そもそも一致条件を満たせず機能していなかったポリシー）
drop policy if exists "topics_select_debug_apikey" on public.topics;
drop policy if exists "sources_select_debug_apikey" on public.sources;
drop policy if exists "feed_items_select_debug_apikey" on public.feed_items;
drop policy if exists "topic_classifications_select_debug_apikey" on public.topic_classifications;
drop policy if exists "reactions_select_debug_apikey" on public.reactions;

-- 2. debug API専用の設定テーブル（1行だけを持つシングルトン）
create table if not exists public.debug_api_config (
  id boolean primary key default true,
  debug_api_key_hash text not null,
  debug_user_id uuid not null references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now(),
  constraint debug_api_config_singleton check (id = true)
);

alter table public.debug_api_config enable row level security;
-- 意図的に一切のSELECT/INSERT/UPDATE/DELETEポリシーを作成しない
-- （RLSはデフォルト拒否のため、ポリシーがなければanon/authenticatedは常にアクセス不可）
revoke all on public.debug_api_config from anon, authenticated;

drop trigger if exists set_updated_at on public.debug_api_config;
create trigger set_updated_at
  before update on public.debug_api_config
  for each row execute function public.set_updated_at();

-- 3. APIキーのハッシュからuser_idを解決する内部ヘルパー関数。
--    anon/authenticatedへは実行権限を与えず、他のSECURITY DEFINER関数からのみ呼ばれる想定。
create or replace function public.debug_resolve_user_id(p_api_key_hash text)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select debug_user_id
  from public.debug_api_config
  where id = true and debug_api_key_hash = p_api_key_hash
$$;

revoke all on function public.debug_resolve_user_id(text) from public;

-- 4. リソースごとの読み取り専用RPC関数（insert/update/deleteは実装しない）。
--    ハッシュが一致しない場合はdebug_resolve_user_idがnullを返し、結果は空集合になる。

create or replace function public.debug_get_topics(p_api_key_hash text)
returns table (
  id uuid,
  name text,
  description text,
  keywords text[],
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select t.id, t.name, t.description, t.keywords, t.created_at, t.updated_at
  from public.topics t
  where t.user_id = public.debug_resolve_user_id(p_api_key_hash)
$$;

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
    s.created_at, s.updated_at,
    case when t.name is null then null else jsonb_build_object('name', t.name) end as topics
  from public.sources s
  left join public.topics t on t.id = s.topic_id
  where s.user_id = public.debug_resolve_user_id(p_api_key_hash)
$$;

create or replace function public.debug_get_feed_items(p_api_key_hash text)
returns table (
  id uuid,
  user_id uuid,
  topic_id uuid,
  source_id uuid,
  title text,
  url text,
  source_name text,
  published_at timestamptz,
  raw_excerpt text,
  summary text,
  ai_comment text,
  relevance_score numeric,
  is_read boolean,
  is_saved boolean,
  image_url text,
  ai_title text,
  ai_summary text,
  ai_processed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  topics jsonb,
  sources jsonb
)
language sql
security definer
set search_path = public
stable
as $$
  select
    f.id, f.user_id, f.topic_id, f.source_id, f.title, f.url, f.source_name,
    f.published_at, f.raw_excerpt, f.summary, f.ai_comment, f.relevance_score,
    f.is_read, f.is_saved, f.image_url, f.ai_title, f.ai_summary, f.ai_processed_at,
    f.created_at, f.updated_at,
    case when t.name is null then null else jsonb_build_object('name', t.name) end as topics,
    case when s.source_score is null then null
      else jsonb_build_object('source_score', s.source_score) end as sources
  from public.feed_items f
  left join public.topics t on t.id = f.topic_id
  left join public.sources s on s.id = f.source_id
  where f.user_id = public.debug_resolve_user_id(p_api_key_hash)
$$;

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
  notes text
)
language sql
security definer
set search_path = public
stable
as $$
  -- raw_result（AIの生応答）は意図的に含めない
  select
    c.topic_id, c.topic_name, c.entity_type, c.parent_category, c.sub_category,
    c.detail_category, c.summary, c.intent_tags, c.recommended_source_types,
    c.search_keywords, c.confidence, c.needs_user_confirmation, c.ambiguity_reason,
    c.candidate_entities, c.research_hints, c.notes
  from public.topic_classifications c
  where c.user_id = public.debug_resolve_user_id(p_api_key_hash)
$$;

create or replace function public.debug_get_reactions(p_api_key_hash text)
returns table (
  feed_item_id uuid,
  reaction_type text
)
language sql
security definer
set search_path = public
stable
as $$
  select r.feed_item_id, r.reaction_type
  from public.reactions r
  where r.user_id = public.debug_resolve_user_id(p_api_key_hash)
$$;

-- 5. 実行権限。debug用の5関数のみanon/authenticatedに許可する
--    （debug_resolve_user_id自体は誰からも直接呼べないよう、実行権限を与えない）
revoke all on function public.debug_get_topics(text) from public;
revoke all on function public.debug_get_sources(text) from public;
revoke all on function public.debug_get_feed_items(text) from public;
revoke all on function public.debug_get_topic_classifications(text) from public;
revoke all on function public.debug_get_reactions(text) from public;

grant execute on function public.debug_get_topics(text) to anon, authenticated;
grant execute on function public.debug_get_sources(text) to anon, authenticated;
grant execute on function public.debug_get_feed_items(text) to anon, authenticated;
grant execute on function public.debug_get_topic_classifications(text) to anon, authenticated;
grant execute on function public.debug_get_reactions(text) to anon, authenticated;
