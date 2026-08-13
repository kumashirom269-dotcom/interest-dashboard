-- 0033_research_vetting_results.sql
-- vetResearchCandidates（AIによるuse/hold/exclude判定）の結果を永続化する。
-- 判定はクラスタ（似た話題の記事のまとまり。feed_itemsとresearch_resultsが混在しうる）
-- 単位で行われ、単一のresearch_results行に1:1で対応しないため、専用テーブルとして持つ。
-- 1回の自動収集実行につき、精査したクラスタの数だけ行を追加する（追記のみ）。

create table if not exists public.research_vetting_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  research_plan_id uuid references public.research_plans(id) on delete set null,

  -- そのクラスタを構成するfeed_items/research_resultsのidを連結した鍵。
  -- 同一パイプライン実行内でクラスタを一意に識別するためのものであり、
  -- 別実行間での同一性は保証しない（再収集のたびにクラスタリングは作り直されるため）。
  cluster_key text not null,

  judgement text not null,
  exclude_reason text,
  reason text,
  matched_positive_signals jsonb not null default '[]'::jsonb,
  matched_negative_signals jsonb not null default '[]'::jsonb,
  representative_title text,
  representative_url text,
  candidate_count integer not null default 0,

  created_at timestamptz not null default now(),

  constraint research_vetting_results_judgement_check check (
    judgement in ('use', 'hold', 'exclude')
  ),
  constraint research_vetting_results_exclude_reason_check check (
    exclude_reason is null or exclude_reason in (
      'too_old', 'low_relevance', 'low_credibility', 'ended_event',
      'duplicate', 'thin_content', 'not_user_intent'
    )
  )
);

create index if not exists idx_research_vetting_results_user_id
  on public.research_vetting_results (user_id);
create index if not exists idx_research_vetting_results_topic_id
  on public.research_vetting_results (topic_id);
create index if not exists idx_research_vetting_results_research_plan_id
  on public.research_vetting_results (research_plan_id);

alter table public.research_vetting_results enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'research_vetting_results' and policyname = 'research_vetting_results_select_own'
  ) then
    create policy "research_vetting_results_select_own"
      on public.research_vetting_results
      for select
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'research_vetting_results' and policyname = 'research_vetting_results_insert_own'
  ) then
    create policy "research_vetting_results_insert_own"
      on public.research_vetting_results
      for insert
      with check (auth.uid() = user_id);
  end if;
end $$;
