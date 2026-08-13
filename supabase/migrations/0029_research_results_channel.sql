-- 0029_research_results_channel.sql
-- ResearchPlan導入に伴い、research_resultsの各行が「どの収集チャネル
-- （公式サイト直接クロール／Brave検索／将来のニュース検索等）」で見つかったかを
-- 記録できるようにする。また、公式サイト直接クロール結果を保存できるよう
-- providerの許容値にofficial_siteを追加する。追加・制約緩和のみで破壊的変更はない。

alter table public.research_results
  add column if not exists channel text;

alter table public.research_results drop constraint if exists research_results_channel_check;
alter table public.research_results add constraint research_results_channel_check
  check (
    channel is null or channel in (
      'rss', 'brave_search', 'official_site', 'news_site', 'event_site',
      'ticket_site', 'local_media', 'social_or_video', 'documentation', 'general_web'
    )
  );

alter table public.research_results drop constraint if exists research_results_provider_check;
alter table public.research_results add constraint research_results_provider_check check (
  provider in ('mock', 'web_search', 'news_search', 'youtube', 'social', 'official_site')
);
