-- 0006_source_score_logs_reason.sql
-- source_score更新履歴に、どのreactionが原因かとその理由テキストを残せるようにする

alter table public.source_score_logs
  add column if not exists reaction_id uuid references public.reactions(id) on delete set null,
  add column if not exists reason text;

create index if not exists idx_source_score_logs_reaction_id
  on public.source_score_logs (reaction_id);
