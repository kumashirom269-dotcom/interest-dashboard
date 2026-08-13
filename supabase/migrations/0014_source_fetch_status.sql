-- 0014_source_fetch_status.sql
-- sourcesの「収集元としての採用状態」(既存のstatus: candidate/active/paused/rejected)と、
-- 「取得方法・検証状態」を分離して管理できるようにする。
-- 既存のstatus/last_checked_at等の列・データには一切手を加えない（追加のみ）。

alter table public.sources
  add column if not exists fetch_method text not null default 'rss',
  add column if not exists fetch_status text not null default 'unverified',
  add column if not exists last_fetch_error_type text,
  add column if not exists last_fetch_error_message text,
  add column if not exists last_fetch_attempt_at timestamptz,
  add column if not exists last_successful_fetch_at timestamptz;

-- fetch_method: このsourceの記事をどう取得するか
--   rss         ... RSS URLから自動取得する（デフォルト）
--   manual      ... RSSがなく、自動取得の手段が今のところない（例: RSSのない公式サイト）
--   unsupported ... SNS・YouTube等、RSS以外の手段が必要で現状未対応（追加APIの導入が必要）
alter table public.sources drop constraint if exists sources_fetch_method_check;
alter table public.sources add constraint sources_fetch_method_check
  check (fetch_method in ('rss', 'manual', 'unsupported'));

-- fetch_status: 直近のRSS取得試行の検証状態
--   unverified ... まだ一度も取得を試みていない（デフォルト）
--   verified   ... 直近の取得に成功した
--   broken     ... 直近の取得に失敗した（last_fetch_error_type/messageに理由が入る）
alter table public.sources drop constraint if exists sources_fetch_status_check;
alter table public.sources add constraint sources_fetch_status_check
  check (fetch_status in ('unverified', 'verified', 'broken'));

-- 既存データのバックフィル：
-- rss_urlが未設定の既存sourceに、デフォルト値'rss'のままだと実態と合わないため、
-- source_typeに応じてfetch_methodを補正する。
-- （youtube_channelはRSS以外の手段＝追加APIが必要なためunsupported、それ以外はmanual扱い）
update public.sources
set fetch_method = case
  when source_type = 'youtube_channel' then 'unsupported'
  else 'manual'
end
where rss_url is null or rss_url = '';
