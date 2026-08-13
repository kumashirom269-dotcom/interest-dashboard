-- 0010_feed_items_ai_optimization.sql
-- 記事一覧のコンパクト表示用に、feed_itemsにAI最適化タイトル・要約・画像URL・処理日時を追加する。
-- image_urlは0009で追加済みの場合もあるため if not exists で安全に扱う。
-- recommendation_cardsテーブルは今回使用しない方針としたが、削除はしない。

alter table public.feed_items
  add column if not exists image_url text,
  add column if not exists ai_title text,
  add column if not exists ai_summary text,
  add column if not exists ai_processed_at timestamptz;
