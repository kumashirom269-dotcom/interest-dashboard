-- 0050_source_consecutive_fetch_failure_count.sql
-- 収集元（sources）に、RSS取得の連続失敗回数を記録するカラムを追加する。
-- 目的: 「取得できませんでした」という警告が、一時的な不調なのか慢性的な不具合
-- なのかをUI側で区別できるようにするため（レビュー指摘: 1回失敗しただけでも
-- 常時失敗し続けても同じ警告文言しか出せず、ユーザーがどう対処すべきか
-- 判断しづらかった）。成功したら0にリセットし、失敗するたびに+1する
-- （実際の更新はapp/(app)/sources/actions.tsのpersistFetchDiagnosticsで行う）。
-- 自動での一時停止・削除は行わない。UI側の警告文言・導線の改善のみに使う。

alter table public.sources
  add column if not exists consecutive_fetch_failure_count integer not null default 0;
