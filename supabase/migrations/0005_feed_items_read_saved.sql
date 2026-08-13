-- 0005_feed_items_read_saved.sql
-- /mypageでの既読・保存状態表示のためのカラムを追加
-- 将来的にreactionsテーブル由来に置き換える可能性はあるが、Step7時点では単純なフラグとして持たせる

alter table public.feed_items
  add column if not exists is_read boolean not null default false,
  add column if not exists is_saved boolean not null default false;
