-- 0027_topic_classifications_understanding.sql
-- トピック理解の構造化結果（TopicUnderstanding）を保存する列を追加。
-- 「何について」「どんな情報を求めているか」をtime_intent（時期の向き）とは別軸で持たせ、
-- 検索クエリ生成・リサーチ精査・カード生成がユーザー意図に沿った判断をできるようにする。
-- 追加のみ・破壊的変更なし。
--
-- 命名について: ユーザー提示の候補カラム名のうち、以下2つは既存列と衝突するため
-- 別名にしている（既存列を壊さないため）。
--   entity_type       → understanding_entity_type
--     （既存のentity_type列は、0008で作成されたTOPIC_ENTITY_TYPESの固定enumで、
--       用途が異なる。今回追加するのは自由記述の短いラベル）
--   ambiguity_reason   → understanding_ambiguity_reason
--     （既存のambiguity_reason列は、0012で作成されたcandidateEntities/
--       needsUserConfirmation系の曖昧性理由で、用途が異なる）

alter table public.topic_classifications
  add column if not exists normalized_topic text,
  add column if not exists entity_name text,
  add column if not exists understanding_entity_type text,
  add column if not exists intent_category text,
  add column if not exists information_needs jsonb not null default '[]'::jsonb,
  add column if not exists priority_signals jsonb not null default '[]'::jsonb,
  add column if not exists negative_signals jsonb not null default '[]'::jsonb,
  add column if not exists search_hints jsonb not null default '[]'::jsonb,
  add column if not exists source_hints jsonb not null default '[]'::jsonb,
  add column if not exists audience_level text,
  add column if not exists location_required boolean not null default false,
  add column if not exists location_text text,
  add column if not exists ambiguity_is_ambiguous boolean not null default false,
  add column if not exists understanding_ambiguity_reason text,
  add column if not exists candidate_meanings jsonb not null default '[]'::jsonb,
  add column if not exists user_intent_summary text;

alter table public.topic_classifications drop constraint if exists topic_classifications_intent_category_check;
alter table public.topic_classifications add constraint topic_classifications_intent_category_check
  check (
    intent_category is null or intent_category in (
      'news', 'event', 'artist', 'local', 'learning', 'technical', 'entertainment',
      'food', 'shopping', 'career', 'finance', 'health', 'evergreen_knowledge', 'other'
    )
  );

alter table public.topic_classifications drop constraint if exists topic_classifications_audience_level_check;
alter table public.topic_classifications add constraint topic_classifications_audience_level_check
  check (
    audience_level is null or audience_level in (
      'beginner', 'general', 'enthusiast', 'expert', 'unknown'
    )
  );
