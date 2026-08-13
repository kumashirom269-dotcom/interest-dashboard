-- 0007_profiles_preferred_feed_language.sql
-- ユーザーごとの記事取得言語設定を追加する

alter table public.profiles
  add column if not exists preferred_feed_language text not null default 'ja';

alter table public.profiles
  drop constraint if exists profiles_preferred_feed_language_check;

alter table public.profiles
  add constraint profiles_preferred_feed_language_check
    check (preferred_feed_language in ('ja', 'en'));
