-- 0038_topic_classifications_topic_kind.sql
-- トピックの種別（TopicKind: entity_topic/theme_topic/seasonal_topic/
-- local_discovery_topic/recommendation_topic/trend_topic/learning_topic/
-- ambiguous_topic/unknown）を保存する列を追加する。
--
-- 「旬な果物」のような固有対象を持たないテーマ型・季節型トピックも登録できるように
-- 対象特定ゲート（lib/ai/identifyTopicEntity.ts）とトピック分類（lib/ai/classifyTopic.ts）を
-- 拡張したことに伴う追加。既存のentity_type（TOPIC_ENTITY_TYPESの固定enum）・
-- understanding_entity_type（自由記述の短いラベル）とは別の、直交する概念のため
-- 新しい列として追加する（追加のみ・破壊的変更なし）。
--
-- 「ユーザーが選択した意味（selected meaning）」自体は、既存のtopic_name/summary列に
-- 既に反映される設計にしたため、別途 selected_meaning_label 等の列は追加していない
-- （previewTopicRegistrationがidentifiedEntity.name/descriptionをそのまま
-- topicName/summaryとして使うため、二重管理を避けた）。

alter table public.topic_classifications
  add column if not exists topic_kind text;

alter table public.topic_classifications drop constraint if exists topic_classifications_topic_kind_check;
alter table public.topic_classifications add constraint topic_classifications_topic_kind_check
  check (
    topic_kind is null or topic_kind in (
      'entity_topic', 'theme_topic', 'seasonal_topic', 'local_discovery_topic',
      'recommendation_topic', 'trend_topic', 'learning_topic', 'ambiguous_topic', 'unknown'
    )
  );
