-- 0004_topics_keywords.sql
-- Topic型（types/domain.ts）が持つkeywordsをtopicsテーブルにも保持する

alter table public.topics
  add column if not exists keywords text[] not null default '{}';
