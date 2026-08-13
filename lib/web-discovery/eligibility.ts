import type { FetchMethod, SourceType } from "@/types/domain";

// RSSがないsourceのうち、Web探索（HTML取得→新着リンク抽出）の対象にしてよいものを判定する。
// SNS・YouTube・開発用サンプル(example.com)は対象外。
// クライアント側（ボタン表示可否）・サーバー側（実行前の安全確認）の両方から使う純粋関数。
const EXCLUDED_SOURCE_TYPES: SourceType[] = [
  "sns",
  "youtube_channel",
  "youtube_search",
];

const EXCLUDED_FETCH_METHODS: FetchMethod[] = [
  "rss",
  "youtube_rss",
  "sns_reference",
  "api_required",
  "unsupported",
  "search_query",
];

const ELIGIBLE_SOURCE_TYPES: SourceType[] = [
  "official_site",
  "official_news",
  "fanclub",
];

export function isWebDiscoveryEligible(source: {
  url: string;
  source_type: SourceType;
  fetch_method?: FetchMethod | null;
}): boolean {
  if (!source.url) return false;
  if (source.url.includes("example.com")) return false;
  if (EXCLUDED_SOURCE_TYPES.includes(source.source_type)) return false;

  const fetchMethod = source.fetch_method ?? "rss";
  if (EXCLUDED_FETCH_METHODS.includes(fetchMethod)) return false;

  if (ELIGIBLE_SOURCE_TYPES.includes(source.source_type)) return true;
  if (fetchMethod === "web_page") return true;
  if (fetchMethod === "manual") return true;

  return false;
}
