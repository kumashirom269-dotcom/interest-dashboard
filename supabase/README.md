# Supabase セットアップ（Step2）

このディレクトリには、アプリの各テーブル・RLS・インデックスを作成するSQLと、
開発確認用の `seed.sql` が入っています。

Step2の時点では、Next.jsアプリからSupabaseへの接続はまだ行いません。
ここではDBの構造だけを先に整えます。

## ファイル構成

```
supabase/
  migrations/
    0001_init.sql     # テーブル定義、check制約、updated_at自動更新、profiles自動作成トリガー
    0002_rls.sql       # RLS有効化とポリシー
    0003_indexes.sql   # インデックス
  seed.sql             # 開発確認用ダミーデータ
```

## 実行順序

Supabase StudioのSQL Editor、または `supabase` CLI のどちらでも実行できます。

### SQL Editorで実行する場合

Supabaseダッシュボード → 該当プロジェクト → SQL Editor で、以下の順に貼り付けて実行してください。

1. `supabase/migrations/0001_init.sql`
2. `supabase/migrations/0002_rls.sql`
3. `supabase/migrations/0003_indexes.sql`
4. （任意・開発確認用）`supabase/seed.sql`

必ずこの順番で実行してください。RLSやインデックスはテーブルが存在しないと作成できません。

### Supabase CLIで実行する場合

プロジェクトルートで `supabase init` 済み、かつ `supabase link` でリモートプロジェクトと紐付け済みであることが前提です。

```bash
# ローカルにSupabaseを起動して確認する場合
supabase start
supabase db reset   # migrations/ 配下を順番に適用 + seed.sqlも自動実行される

# リモート（本番/開発プロジェクト）に反映する場合
supabase db push
```

`supabase db reset` は `supabase/seed.sql` を自動で実行する仕様のため、ローカル確認時は
seedデータも含めて一括で反映されます。リモートに対して seed.sql を流したい場合は、
SQL Editor に直接貼り付けて実行してください。

## 注意点

### profilesとauth.usersの関係

`profiles.id` は Supabase Authで発行される `auth.users.id` と同じ値を使う想定です。
`0001_init.sql` 内の `handle_new_user()` トリガーが、ユーザーのサインアップ時に
自動で `public.profiles` へ行を作成します（Step3のAuth実装で実際に動作確認します）。

### seed.sqlについて

`seed.sql` は実際の `auth.users` 行を作らず、固定UUID
（`11111111-1111-1111-1111-111111111111`）のprofileを直接insertしています。
そのため、このUUIDで実際にログインすることはできません。あくまでSupabase Studioの
テーブルエディタやSQL上でデータの見た目を確認するための開発用データです。

実際にログインして自分のデータとして確認したい場合は、Step3以降でSupabase Auth経由の
ユーザーを作成し、そのユーザーの `auth.users.id` を確認したうえで、`seed.sql` 内の
`11111111-1111-1111-1111-111111111111` を書き換えてから再実行してください。

### RLSとSQL Editorの関係

Supabase StudioのSQL Editorは基本的に `postgres` ロール（テーブルオーナー）で実行されるため、
RLSポリシーをバイパスして `seed.sql` のinsertが成功します。
一方、Next.jsアプリ（`anon` / `authenticated` ロール経由）から同じinsertを行うと、
`auth.uid() = user_id` を満たさない限りRLSにより拒否されます。これは意図した挙動です。

## 次のステップ

Step3でSupabase Authを実装し、実際にログインユーザーの `auth.uid()` を使って
RLSが正しく機能することを確認します。
