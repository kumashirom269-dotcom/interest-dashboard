-- 0049_delete_own_account.sql
-- App Store審査（Guideline 2.1 / 5.1.1(v)）対応: アカウント作成に対応するアプリは
-- アプリ内から自分でアカウントを削除できる導線を用意する必要がある。
-- これまでは「お問い合わせいただければ削除する」という運用のみで、アプリ内に
-- 削除機能が無かった。
--
-- public.profilesを起点に、topics/sources/feed_items/reactions/recommendation_cards等
-- ほぼ全テーブルが user_id references public.profiles(id) on delete cascade で
-- 連なっているため、profilesの行を消せばアプリ側のデータはまとめて消える。
-- ただし public.profiles.id と auth.users.id の間には外部キー制約が無い
-- （0001_init.sqlのhandle_new_user()トリガーで値を揃えているだけ）ため、
-- Supabase Auth側のアカウント（auth.users）は別途削除する必要がある。
-- auth.usersの削除にはanon/authenticatedロールには無い権限が必要なため、
-- SECURITY DEFINER関数として実装し、auth.uid()（呼び出し本人のIDのみ、
-- 引数でuser_idを受け取らない）を対象に限定する。

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid := auth.uid();
begin
  if target_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- アプリ側の全データ（topics/sources/feed_items/reactions/recommendation_cards等）は
  -- user_id references public.profiles(id) on delete cascade で連なっているため、
  -- この1行を消すだけでまとめて削除される。
  delete from public.profiles where id = target_user_id;

  -- Supabase Authのアカウント自体を削除する（ログイン手段そのものを消す）。
  delete from auth.users where id = target_user_id;
end;
$$;

revoke all on function public.delete_own_account() from public;
-- 未ログイン（anon）からは呼べないようにし、ログイン済み本人のみ実行可能にする。
grant execute on function public.delete_own_account() to authenticated;
