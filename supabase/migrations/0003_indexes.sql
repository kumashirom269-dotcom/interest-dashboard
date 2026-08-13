-- 0003_indexes.sql
-- 検索・表示順で頻繁に使うカラムの組み合わせにインデックスを張る

create index if not exists idx_topics_user_id
  on public.topics (user_id);

create index if not exists idx_sources_user_id_topic_id
  on public.sources (user_id, topic_id);

create index if not exists idx_sources_user_id_status
  on public.sources (user_id, status);

create index if not exists idx_feed_items_user_id_topic_id_published_at
  on public.feed_items (user_id, topic_id, published_at desc);

create index if not exists idx_feed_items_user_id_source_id
  on public.feed_items (user_id, source_id);

create index if not exists idx_feed_items_user_id_url
  on public.feed_items (user_id, url);

create index if not exists idx_reactions_user_id_feed_item_id
  on public.reactions (user_id, feed_item_id);

create index if not exists idx_reactions_source_id_reaction_type
  on public.reactions (source_id, reaction_type);

create index if not exists idx_source_score_logs_user_id_source_id
  on public.source_score_logs (user_id, source_id);

create index if not exists idx_source_score_logs_source_id_created_at
  on public.source_score_logs (source_id, created_at desc);
