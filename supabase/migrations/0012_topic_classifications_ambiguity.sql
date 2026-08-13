-- 0012_topic_classifications_ambiguity.sql
-- 既存のtopic_classificationsに、曖昧なトピックの確認候補・曖昧理由・
-- 将来のWeb調査観点を保存するためのカラムを追加する（破壊的変更なし）。

alter table public.topic_classifications
  add column if not exists ambiguity_reason text,
  add column if not exists candidate_entities jsonb not null default '[]'::jsonb,
  add column if not exists research_hints text[] not null default '{}';
