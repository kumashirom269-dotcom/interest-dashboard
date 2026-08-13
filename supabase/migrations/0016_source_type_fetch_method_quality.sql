-- 0016_source_type_fetch_method_quality.sql
-- Phase1: source_type / fetch_method の拡張と、source品質管理カラムの追加。
-- 破壊的変更なし（制約の拡張・カラム追加のみ。既存データの削除・書き換えは行わない）。
--
-- 3つの軸を分離して管理する:
--   source_type ... その情報源が何か（公式サイト/SNS/YouTube/ニュース等）
--   fetch_method ... どう取得するか（RSS/Web探索/検索/手動等）
--   品質管理カラム ... どれだけ信頼できる・具体的か、確認が必要か

-- 1. source_type の拡張（既存値はすべて維持したまま追加）
alter table public.sources drop constraint if exists sources_source_type_check;
alter table public.sources add constraint sources_source_type_check check (
  source_type in (
    'official_blog', 'news_site', 'rss', 'tech_blog', 'local_event_site',
    'youtube_channel', 'research_site', 'other',
    'official_site', 'official_news', 'fanclub', 'sns', 'youtube_search',
    'magazine', 'blog', 'search_query'
  )
);

-- 2. fetch_method の拡張（既存値はすべて維持したまま追加）。
--    official_siteは「情報源の種類」であってfetch_methodには含めない
--    （source_type側で表現する）。
alter table public.sources drop constraint if exists sources_fetch_method_check;
alter table public.sources add constraint sources_fetch_method_check check (
  fetch_method in (
    'rss', 'manual', 'unsupported',
    'youtube_rss', 'web_page', 'search_query', 'sns_reference', 'api_required'
  )
);

-- 3. source品質管理カラム
alter table public.sources
  add column if not exists is_official boolean not null default false,
  add column if not exists is_specific_source boolean not null default true,
  add column if not exists is_search_seed boolean not null default false,
  add column if not exists source_reliability_score integer,
  add column if not exists topic_relevance_score integer,
  add column if not exists needs_review boolean not null default false,
  add column if not exists review_reason text;

alter table public.sources drop constraint if exists sources_source_reliability_score_check;
alter table public.sources add constraint sources_source_reliability_score_check
  check (source_reliability_score is null or source_reliability_score between 0 and 100);

alter table public.sources drop constraint if exists sources_topic_relevance_score_check;
alter table public.sources add constraint sources_topic_relevance_score_check
  check (topic_relevance_score is null or topic_relevance_score between 0 and 100);
