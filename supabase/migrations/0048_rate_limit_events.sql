-- 0048_rate_limit_events.sql
-- 一般公開に向けたレート制限対応。トピック登録フロー（対象特定・分類プレビュー・
-- 初期自動収集の確定）はAnthropic API・Brave Search APIを複数回呼び出すため、
-- 悪意・誤操作による連打でAPIコストが青天井になるのを防ぐ目的で導入する。
--
-- 実装方針: サーバーレス環境（Vercel）ではインメモリのレート制限がインスタンス間で
-- 共有できないため、DBに呼び出しイベントを1行ずつ記録し、直近の行数を数える方式にする
-- （lib/rate-limit/queries.ts参照）。service_role keyを使わずanon+RLSで完結させる、
-- 既存のこのプロジェクトの方針に合わせている。

create table if not exists public.rate_limit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- レート制限の対象アクション名（例: "topic_registration_heavy"）。
  -- 同じユーザーでも用途ごとに独立して数えられるようにキーを分ける。
  action text not null,
  created_at timestamptz not null default now()
);

-- 直近N分/N時間の件数カウント（user_id, action, created_at範囲での絞り込み）が
-- 主なアクセスパターンのため、この3列の複合インデックスを作る。
create index if not exists idx_rate_limit_events_user_action_created
  on public.rate_limit_events (user_id, action, created_at desc);

-- 古い行は集計に使われなくなるだけで安全に消してよい（監査目的の永続化はしない）。
-- 定期的なクリーンアップは運用側で（例: pg_cron や手動）行う想定とし、
-- ここではテーブル・インデックスの用意のみ行う。

alter table public.rate_limit_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'rate_limit_events' and policyname = 'rate_limit_events_select_own'
  ) then
    create policy "rate_limit_events_select_own"
      on public.rate_limit_events
      for select
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'rate_limit_events' and policyname = 'rate_limit_events_insert_own'
  ) then
    create policy "rate_limit_events_insert_own"
      on public.rate_limit_events
      for insert
      with check (auth.uid() = user_id);
  end if;
end $$;

-- update/deleteポリシーは意図的に用意しない（イベントは記録のみ・改ざん不可にする）。
