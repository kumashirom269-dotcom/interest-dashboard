-- 0031_research_plans.sql
-- ResearchPlan（AIが立てたリサーチ方針）をDBへ永続化する。
-- これまでは1回のパイプライン実行の間だけメモリ上に保持し、AutoCollectionResult経由で
-- 登録直後の画面にしか橋渡ししていなかったが、debugや事後検証のために保存する。
-- 1トピックにつき自動収集を実行するたびに1行追加していく想定（追記のみ、更新はしない）。

create table if not exists public.research_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,

  topic_name text not null,
  primary_goal text,
  preferred_channels jsonb not null default '[]'::jsonb,
  search_queries jsonb not null default '[]'::jsonb,
  official_site_queries jsonb not null default '[]'::jsonb,
  event_queries jsonb not null default '[]'::jsonb,
  exclusion_queries jsonb not null default '[]'::jsonb,
  must_include_signals jsonb not null default '[]'::jsonb,
  must_exclude_signals jsonb not null default '[]'::jsonb,
  source_priority jsonb,
  freshness_policy jsonb,
  expected_result_types jsonb not null default '[]'::jsonb,
  notes_for_vetting text,
  -- ResearchPlan全体（userIntentSummary含む）をそのまま保持する。個別カラムは
  -- debug APIやSQLでの絞り込みを楽にするためのものであり、読み取り時は
  -- raw_planを正とし、個別カラムが欠けている場合のフォールバックにも使う。
  raw_plan jsonb,

  created_at timestamptz not null default now()
);

create index if not exists idx_research_plans_user_id on public.research_plans (user_id);
create index if not exists idx_research_plans_topic_id on public.research_plans (topic_id);

alter table public.research_plans enable row level security;

-- 追記のみのログとして扱うため、select/insertのみ許可する（update/deleteポリシーは作らない）。
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'research_plans' and policyname = 'research_plans_select_own'
  ) then
    create policy "research_plans_select_own"
      on public.research_plans
      for select
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'research_plans' and policyname = 'research_plans_insert_own'
  ) then
    create policy "research_plans_insert_own"
      on public.research_plans
      for insert
      with check (auth.uid() = user_id);
  end if;
end $$;
