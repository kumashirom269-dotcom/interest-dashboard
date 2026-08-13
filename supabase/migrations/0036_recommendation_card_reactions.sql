-- 0036_recommendation_card_reactions.sql
-- recommendation_cards（マイページの主役であるおすすめカード）に対するユーザーリアクションを
-- 保存する。既存のreactionsテーブルはfeed_item_id前提の設計（source_idも必須）であり、
-- recommendation_cardsは複数のfeed_items/research_resultsから再構成された別物のため、
-- 既存reactionsテーブルを無理に拡張せず、新テーブルとして独立させる。
--
-- reaction_typeは既存reactionsの語彙（useful/not_relevant等）とは意図的に別の語彙にする
-- （like/bad/save/hide/click）。カード特有の「クリック」を集計したいことと、
-- 既存のfeed_item用reaction_type語彙とは評価軸が異なるため。

create table if not exists public.recommendation_card_reactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  recommendation_card_id uuid not null references public.recommendation_cards(id) on delete cascade,
  -- 集計・debug表示を楽にするための非正規化列（recommendation_cards.topic_idの複製）。
  topic_id uuid references public.topics(id) on delete set null,
  reaction_type text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint recommendation_card_reactions_reaction_type_check check (
    reaction_type in ('like', 'bad', 'save', 'hide', 'click')
  ),
  -- like/bad/save/hideはトグル（1人1カードにつき1種類は1行のみ）。
  -- clickはトグルではなく「記録＋recommendation_cards.click_scoreへの加算」で扱うため、
  -- この一意制約により2回目以降のクリックはinsertではなくupdate（updated_atの更新のみ）になる
  -- （lib/recommendation-card-reactions/queries.tsのrecordRecommendationCardClick参照）。
  constraint recommendation_card_reactions_user_card_type_unique unique (
    user_id, recommendation_card_id, reaction_type
  )
);

create index if not exists idx_recommendation_card_reactions_user_id
  on public.recommendation_card_reactions (user_id);
create index if not exists idx_recommendation_card_reactions_card_id
  on public.recommendation_card_reactions (recommendation_card_id);
create index if not exists idx_recommendation_card_reactions_topic_id
  on public.recommendation_card_reactions (topic_id);

drop trigger if exists set_updated_at on public.recommendation_card_reactions;
create trigger set_updated_at
  before update on public.recommendation_card_reactions
  for each row execute function public.set_updated_at();

alter table public.recommendation_card_reactions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'recommendation_card_reactions' and policyname = 'recommendation_card_reactions_select_own'
  ) then
    create policy "recommendation_card_reactions_select_own"
      on public.recommendation_card_reactions
      for select
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'recommendation_card_reactions' and policyname = 'recommendation_card_reactions_insert_own'
  ) then
    create policy "recommendation_card_reactions_insert_own"
      on public.recommendation_card_reactions
      for insert
      with check (auth.uid() = user_id);
  end if;
end $$;

-- clickのupsert（insert ... on conflict ... do update）にはupdateポリシーも必要。
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'recommendation_card_reactions' and policyname = 'recommendation_card_reactions_update_own'
  ) then
    create policy "recommendation_card_reactions_update_own"
      on public.recommendation_card_reactions
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'recommendation_card_reactions' and policyname = 'recommendation_card_reactions_delete_own'
  ) then
    create policy "recommendation_card_reactions_delete_own"
      on public.recommendation_card_reactions
      for delete
      using (auth.uid() = user_id);
  end if;
end $$;
