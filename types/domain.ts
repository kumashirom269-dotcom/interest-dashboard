// ドメイン型定義。Supabaseのテーブル設計に合わせているため、
// Step2以降でDB接続に切り替える際もこの型をそのまま流用できるようにする。

export type SourceType =
  | "official_blog"
  | "news_site"
  | "rss"
  | "tech_blog"
  | "local_event_site"
  | "youtube_channel"
  | "research_site"
  | "other"
  | "official_site"
  | "official_news"
  | "fanclub"
  | "sns"
  | "youtube_search"
  | "magazine"
  | "blog"
  | "search_query";

export type SourceStatus = "candidate" | "active" | "paused" | "rejected";

// sourceの「収集元としての採用状態」(status)とは別に管理する「取得方法・検証状態」。
// fetch_methodは「どう取得するか」のみを表す（情報源の種類はsource_type側で表現する）。
export type FetchMethod =
  | "rss"
  | "manual"
  | "unsupported"
  | "youtube_rss"
  | "web_page"
  | "search_query"
  | "sns_reference"
  | "api_required";
export type FetchStatus = "unverified" | "verified" | "broken";

export type ReactionType =
  | "useful"
  | "not_relevant"
  | "save"
  | "hide"
  | "more_from_source"
  | "less_from_source";

export interface Topic {
  id: string;
  user_id: string;
  name: string;
  description: string;
  keywords: string[];
  // 自動収集パイプライン（トピック登録直後の初期探索・将来のマイページ再収集判定）を
  // 最後に実行した日時。まだ一度も実行していない場合はnull。
  last_collected_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Source {
  id: string;
  user_id: string;
  topic_id: string;
  name: string;
  url: string;
  rss_url: string | null;
  source_type: SourceType;
  status: SourceStatus;
  reason: string;
  priority: number;
  source_score: number;
  created_by_ai: boolean;
  last_checked_at: string | null;
  fetch_method?: FetchMethod;
  fetch_status?: FetchStatus;
  last_fetch_error_type?: string | null;
  last_fetch_error_message?: string | null;
  last_fetch_attempt_at?: string | null;
  last_successful_fetch_at?: string | null;
  is_official?: boolean;
  is_specific_source?: boolean;
  is_search_seed?: boolean;
  source_reliability_score?: number | null;
  topic_relevance_score?: number | null;
  needs_review?: boolean;
  review_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeedItem {
  id: string;
  user_id: string;
  topic_id: string;
  source_id: string;
  title: string;
  url: string;
  source_name: string;
  published_at: string;
  raw_excerpt: string;
  summary: string;
  ai_comment: string;
  related_topics: string[];
  relevance_score: number;
  is_read?: boolean;
  is_saved?: boolean;
  image_url?: string | null;
  ai_title?: string | null;
  ai_summary?: string | null;
  ai_processed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Reaction {
  id: string;
  user_id: string;
  feed_item_id: string;
  source_id: string;
  reaction_type: ReactionType;
  created_at: string;
}

export const REACTION_LABELS: Record<ReactionType, string> = {
  useful: "役に立った",
  not_relevant: "あまり関係ない",
  save: "保存",
  hide: "非表示",
  more_from_source: "この情報源をもっと見たい",
  less_from_source: "この情報源を減らしたい",
};

export const SOURCE_STATUS_LABELS: Record<SourceStatus, string> = {
  candidate: "候補",
  active: "採用中",
  paused: "一時停止",
  rejected: "却下",
};

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  official_blog: "公式ブログ",
  news_site: "ニュースサイト",
  rss: "RSS",
  tech_blog: "技術ブログ",
  local_event_site: "地域イベントサイト",
  youtube_channel: "YouTubeチャンネル",
  research_site: "研究サイト",
  other: "その他",
  official_site: "公式サイト",
  official_news: "公式発表・プレスリリース",
  fanclub: "ファンクラブ",
  sns: "SNS",
  youtube_search: "YouTube検索",
  magazine: "雑誌・メディア",
  blog: "ブログ",
  search_query: "検索クエリ",
};
