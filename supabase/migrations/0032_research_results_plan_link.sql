-- 0032_research_results_plan_link.sql
-- research_resultsを、生成元のResearchPlan（0031_research_plans.sql）・追加検索かどうか・
-- 公式サイト/検索結果ページから軽く取得したページ要約と紐づけられるようにする。
-- 追加・制約緩和のみで破壊的変更はない。

alter table public.research_results
  add column if not exists research_plan_id uuid references public.research_plans(id) on delete set null;

alter table public.research_results
  add column if not exists is_follow_up boolean not null default false;

alter table public.research_results
  add column if not exists follow_up_reason text;

-- fetchWebPageSummaryによる軽量なページ要約取得結果（title/description/og:image）。
-- 既存のtitle/snippet/image_url（Provider・discoverLinksForUrlが決めた値）とは別に保持し、
-- 後から「Web取得で何が得られたか」を区別して確認できるようにする。
alter table public.research_results
  add column if not exists fetched_page_title text;

alter table public.research_results
  add column if not exists fetched_page_description text;

alter table public.research_results
  add column if not exists fetched_image_url text;

alter table public.research_results
  add column if not exists fetch_status text;

alter table public.research_results drop constraint if exists research_results_fetch_status_check;
alter table public.research_results add constraint research_results_fetch_status_check
  check (fetch_status is null or fetch_status in ('success', 'failed', 'skipped'));

create index if not exists idx_research_results_research_plan_id
  on public.research_results (research_plan_id);
