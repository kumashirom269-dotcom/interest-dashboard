-- 0025_topic_classifications_time_intent.sql
-- トピックが「過去・現在・未来のどの時期の情報」を求めているかを表すtime_intentを追加。
-- freshness_profile（更新頻度）とは別軸で、リサーチ精査ステップ
-- （lib/ai/vetResearchCandidates.ts）が「古い情報を除外してよいか」を判断するために使う。
-- 追加のみ・破壊的変更なし。

alter table public.topic_classifications
  add column if not exists time_intent text,
  add column if not exists time_intent_reason text;

alter table public.topic_classifications drop constraint if exists topic_classifications_time_intent_check;
alter table public.topic_classifications add constraint topic_classifications_time_intent_check
  check (
    time_intent is null or time_intent in (
      'current_or_future', 'recent', 'historical', 'specific_period', 'evergreen'
    )
  );
