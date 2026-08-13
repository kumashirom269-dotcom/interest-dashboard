-- 0021_topics_auto_collection.sql
-- トピック登録後の自動情報収集パイプライン（Phase1）のための最小カラム追加。
-- 追加のみ・破壊的変更なし。
--
-- topics.last_collected_at: このトピックの自動収集パイプラインを最後に実行した日時。
--   マイページ表示時の再収集判定（Phase2で実装予定）の基準になる。
-- topic_classifications: AIが判定した「情報の鮮度プロファイル」。
--   マイページ表示のたびに毎回AIで再収集するのではなく、トピックの性質に応じた
--   最短更新間隔・カード表示期限の目安として使う。

alter table public.topics
  add column if not exists last_collected_at timestamptz;

alter table public.topic_classifications
  add column if not exists freshness_profile text,
  add column if not exists freshness_reason text,
  add column if not exists min_refresh_interval_minutes integer,
  add column if not exists default_card_ttl_hours integer;

alter table public.topic_classifications drop constraint if exists topic_classifications_freshness_profile_check;
alter table public.topic_classifications add constraint topic_classifications_freshness_profile_check
  check (
    freshness_profile is null or freshness_profile in (
      'breaking', 'high_frequency', 'daily', 'seasonal', 'evergreen'
    )
  );
