-- 0020_topic_classifications_identification.sql
-- トピック登録時の「対象特定ゲート」（identifyTopicEntity）で特定できた対象の
-- 正式名称・URL類をtopic_classificationsに保存できるようにする（追加のみ、破壊的変更なし）。
-- 対象特定ゲートを通過して作成されたtopic_classifications行にのみ値が入る想定で、
-- それ以前のロジック（手動「AIで分類」ボタン等）はこれらの列に触れないため、
-- 既存データ・既存の動作には影響しない。

alter table public.topic_classifications
  add column if not exists identification_status text,
  add column if not exists canonical_url text,
  add column if not exists official_url text,
  add column if not exists youtube_channel_url text;

alter table public.topic_classifications drop constraint if exists topic_classifications_identification_status_check;
alter table public.topic_classifications add constraint topic_classifications_identification_status_check
  check (
    identification_status is null or identification_status in (
      'identified', 'needs_selection', 'needs_more_info', 'not_identifiable'
    )
  );
