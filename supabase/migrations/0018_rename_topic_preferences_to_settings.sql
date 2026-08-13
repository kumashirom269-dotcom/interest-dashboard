-- 0018_rename_topic_preferences_to_settings.sql
-- 既存の「AIの好み設定」機能（target_level/display_tone等、1トピックにつき1行）は
-- 内容・機能とも一切変更せず、テーブル名のみ topic_preference_settings に変更する。
-- これにより、topic_preferences という名前を新しい「AI生成カテゴリ選択」機能
-- （0019_topic_preferences_categories.sqlで作成）に明け渡す。
-- 既存データ・既存の型/検証ロジックは一切変更しない（リネームのみ）。
--
-- rename系のDDLはIF EXISTSがない（またはあっても不十分な）ものが多く、
-- 1回目の実行で改名が完了した後にSQL Editorで誤って再実行すると
-- 「relation does not exist」「policy does not exist」等でエラーになる。
-- そのため、各文を「まだ改名されていない場合のみ実行する」DO $$ ... $$ブロックで包む
-- （既存データ・既存の挙動は変更しない。単に再実行時にエラーで止まらないようにするだけ）。

do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'topic_preferences')
     and not exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'topic_preference_settings')
  then
    alter table public.topic_preferences rename to topic_preference_settings;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'topic_preferences_target_level_check'
  ) then
    alter table public.topic_preference_settings
      rename constraint topic_preferences_target_level_check to topic_preference_settings_target_level_check;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'topic_preferences_display_tone_check'
  ) then
    alter table public.topic_preference_settings
      rename constraint topic_preferences_display_tone_check to topic_preference_settings_display_tone_check;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'topic_preferences_topic_id_unique'
  ) then
    alter table public.topic_preference_settings
      rename constraint topic_preferences_topic_id_unique to topic_preference_settings_topic_id_unique;
  end if;
end $$;

-- 単純な"ALTER INDEX IF EXISTS ... RENAME TO"は、リネーム元の存在有無しか見ないため、
-- 0019が新しいtopic_preferencesテーブル用に同名のidx_topic_preferences_user_idを
-- 作成した後にこのファイルを再実行すると、リネーム先(idx_topic_preference_settings_user_id)が
-- 既に存在していてもリネームを試みてしまい「already exists」で失敗する。
-- そのため、リネーム元・リネーム先の両方を確認してから実行する。
do $$
begin
  if exists (
    select 1 from pg_indexes where schemaname = 'public' and indexname = 'idx_topic_preferences_user_id'
  )
     and not exists (
    select 1 from pg_indexes where schemaname = 'public' and indexname = 'idx_topic_preference_settings_user_id'
  )
  then
    alter index public.idx_topic_preferences_user_id
      rename to idx_topic_preference_settings_user_id;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'topic_preference_settings' and policyname = 'topic_preferences_select_own'
  ) then
    alter policy "topic_preferences_select_own" on public.topic_preference_settings
      rename to "topic_preference_settings_select_own";
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'topic_preference_settings' and policyname = 'topic_preferences_insert_own'
  ) then
    alter policy "topic_preferences_insert_own" on public.topic_preference_settings
      rename to "topic_preference_settings_insert_own";
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'topic_preference_settings' and policyname = 'topic_preferences_update_own'
  ) then
    alter policy "topic_preferences_update_own" on public.topic_preference_settings
      rename to "topic_preference_settings_update_own";
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'topic_preference_settings' and policyname = 'topic_preferences_delete_own'
  ) then
    alter policy "topic_preferences_delete_own" on public.topic_preference_settings
      rename to "topic_preference_settings_delete_own";
  end if;
end $$;
