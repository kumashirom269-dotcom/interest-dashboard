-- 0044_score_dedupe_and_research_result_genre_columns.sql
-- レビュー指摘（前回実装の未接続項目）への対応。以下を実際にTypeScript側から
-- 読み書きするようになったため、対応するカラムを追加する。
--
-- recommendation_cards:
--   information_value_score / score_breakdown … lib/recommendation/scoreInformationValue.ts
--     の計算結果（app/(app)/topics/actions.tsのカード生成時に保存）。
--   dedupe_key … lib/recommendation-cards/dedupeKey.ts。hide/seenによる同一クラスタの
--     再表示抑制に使う（実行間の緩やかな同一性判定。完全な同一性保証ではない）。
--   entity_name … TopicUnderstanding.entityNameのコピー。同一エンティティの連続表示抑制に使う。
--
-- research_results:
--   genre_id / information_types / cross_genre_tags / risk_level … トピックのジャンル情報を
--     候補保存時点で複製し、候補精査・クラスタリング・カード生成・Debug APIの間で
--     ジャンル情報が失われないようにする（lib/research/queries.tsの
--     enrichResearchResultsWithGenreInfo参照）。
--   source_tier … 三層構造（lib/research-review/sourceTier.ts）上の格付け。収集時に
--     channel・公式性から機械的に算出する。
--   requires_verification / verification_issues … Tier3単独では確定できない情報タイプに
--     該当する等、追加確認が必要と判定された場合に立てるフラグ。
--   temporal_status … 現在有効/終了済み等の時期区分（今回は"unknown"既定、将来の拡張用）。
--
-- すべて追加専用（add column if not exists）。既存カラム・データへの影響はない。

alter table public.recommendation_cards
  add column if not exists information_value_score numeric,
  add column if not exists score_breakdown jsonb,
  add column if not exists dedupe_key text,
  add column if not exists entity_name text;

alter table public.research_results
  add column if not exists genre_id text,
  add column if not exists information_types jsonb not null default '[]',
  add column if not exists cross_genre_tags jsonb not null default '[]',
  add column if not exists risk_level text,
  add column if not exists source_tier smallint,
  add column if not exists requires_verification boolean not null default false,
  add column if not exists verification_issues jsonb not null default '[]',
  add column if not exists temporal_status text not null default 'unknown';

alter table public.research_results drop constraint if exists research_results_source_tier_check;
alter table public.research_results add constraint research_results_source_tier_check
  check (source_tier is null or source_tier in (1, 2, 3));

alter table public.research_results drop constraint if exists research_results_temporal_status_check;
alter table public.research_results add constraint research_results_temporal_status_check
  check (temporal_status in ('upcoming', 'ongoing', 'recent', 'ended', 'expired', 'unknown', 'evergreen'));

-- カードのdedupeKeyによる同一クラスタ検索・research_resultsのジャンル別集計を
-- Debug APIやselectDashboardCardsの将来的なDB側フィルタリングで使えるようにする。
create index if not exists idx_recommendation_cards_dedupe_key
  on public.recommendation_cards (topic_id, dedupe_key);
create index if not exists idx_research_results_genre_id
  on public.research_results (genre_id);
