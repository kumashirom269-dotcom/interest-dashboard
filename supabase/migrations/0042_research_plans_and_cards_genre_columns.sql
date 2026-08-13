-- 0042_research_plans_and_cards_genre_columns.sql
-- 33ジャンル統合エンジン導入。research_plansとrecommendation_cardsに、実際にアプリコードが
-- 書き込む33ジャンル関連カラムのみを追加する（research_results/research_vetting_results/
-- sourcesへのジャンル関連カラムは、対応するTypeScript側の書き込みロジックが今回のスコープでは
-- 未実装のため、意図的に見送っている。詳細は完了報告の「未実装・残課題」を参照）。
-- すべて追加専用（add column if not exists）。

alter table public.research_plans
  add column if not exists primary_genre_id text;

alter table public.recommendation_cards
  add column if not exists genre_id text,
  add column if not exists information_types jsonb not null default '[]',
  add column if not exists cross_genre_tags jsonb not null default '[]',
  add column if not exists risk_level text,
  add column if not exists freshness_level text,
  add column if not exists warnings jsonb not null default '[]';
