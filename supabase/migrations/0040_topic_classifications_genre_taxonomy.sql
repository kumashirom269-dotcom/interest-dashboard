-- 0040_topic_classifications_genre_taxonomy.sql
-- 33ジャンル統合エンジン導入。topic_classificationsに固定33ジャンル分類
-- （primary_genre_id等）を追加する。既存のparent_category/sub_category/detail_category
-- （自由記述、非推奨化）・topic_kind・intent_category/information_needsは削除せず、
-- 後方互換のためそのまま残す（アプリ側はこれらの値をprimary_genre_id系から自動生成する）。
-- すべて追加専用（add column if not exists）で、既存データを破壊しない。

alter table public.topic_classifications
  add column if not exists primary_genre_id text,
  add column if not exists secondary_genre_ids jsonb not null default '[]',
  add column if not exists auxiliary_genre_ids jsonb not null default '[]',
  add column if not exists information_types jsonb not null default '[]',
  add column if not exists cross_genre_tags jsonb not null default '[]',
  add column if not exists applied_cross_genre_rule_ids jsonb not null default '[]';

comment on column public.topic_classifications.primary_genre_id is
  '33ジャンル分類（lib/genres/definitions.tsのgenreId）。topicKindとは独立した軸。';
