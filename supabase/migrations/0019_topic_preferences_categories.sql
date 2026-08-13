-- 0019_topic_preferences_categories.sql
-- トピック登録時にAIが提案する「集めたい情報カテゴリ」を保存するテーブル。
-- 1トピックにつき複数行（カテゴリごとに1行）を持つ点が、
-- 0018でリネームしたtopic_preference_settings（1トピック1行の好み設定）と異なる。
--
-- category_typeは、recommendation_cards.information_typeと同じ語彙を再利用する
-- （どちらも「情報の種類」を表す概念のため、将来「選択カテゴリの優先度でカードを
-- 重みづけする」処理を実装する際に、変換テーブルなしで直接突き合わせられるようにする）。
--
-- 選択状態(is_selected)は情報収集の強い除外フィルターではなく、
-- ランキング・要約・情報源探索の重みづけとして扱う想定（アプリ側のロジックで解釈する）。

create table if not exists public.topic_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  label text not null,
  description text not null default '',
  category_type text not null default 'other',
  preference_key text not null,
  is_selected boolean not null default false,
  priority integer not null default 50,
  ai_generated boolean not null default true,
  source text not null default 'ai',
  -- 将来拡張用（今回のUIでは未使用）。
  -- visible_to_user: 登録確認画面に表示したカテゴリかどうか。
  --   将来、ユーザーには見せないが内部的に考慮するカテゴリを持たせる場合に備える。
  -- weight / negative_weight: ランキング計算で使う重み（正の重み・負の重み）。
  -- display_order: 画面表示順を明示的に固定したい場合に使う。
  visible_to_user boolean not null default true,
  weight integer,
  negative_weight integer,
  display_order integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint topic_preferences_category_type_check check (
    category_type in (
      'tv_appearance', 'event', 'new_opening', 'release', 'movie', 'music_news',
      'sns_trend', 'local_news', 'technology_update', 'creator_post',
      'official_announcement', 'sale_campaign', 'travel_recommendation', 'other'
    )
  ),
  constraint topic_preferences_source_check check (
    source in ('ai', 'user', 'system')
  ),
  constraint topic_preferences_priority_check check (priority between 0 and 100),
  constraint topic_preferences_topic_key_unique unique (topic_id, preference_key)
);

create index if not exists idx_topic_preferences_user_id
  on public.topic_preferences (user_id);
create index if not exists idx_topic_preferences_topic_id
  on public.topic_preferences (topic_id);

-- ============================================================
-- updated_at 自動更新（既存のset_updated_at()トリガー関数を再利用）
-- ============================================================
drop trigger if exists set_updated_at on public.topic_preferences;
create trigger set_updated_at
  before update on public.topic_preferences
  for each row execute function public.set_updated_at();

-- ============================================================
-- RLS
-- ============================================================
alter table public.topic_preferences enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'topic_preferences' and policyname = 'topic_preferences_select_own'
  ) then
    create policy "topic_preferences_select_own"
      on public.topic_preferences
      for select
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'topic_preferences' and policyname = 'topic_preferences_insert_own'
  ) then
    create policy "topic_preferences_insert_own"
      on public.topic_preferences
      for insert
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'topic_preferences' and policyname = 'topic_preferences_update_own'
  ) then
    create policy "topic_preferences_update_own"
      on public.topic_preferences
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'topic_preferences' and policyname = 'topic_preferences_delete_own'
  ) then
    create policy "topic_preferences_delete_own"
      on public.topic_preferences
      for delete
      using (auth.uid() = user_id);
  end if;
end $$;
