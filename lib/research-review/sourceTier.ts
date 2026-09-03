// 三層構造（仕様書5-7）の実処理向け実装。
//
// channel（"official_site"等）は、収集時にどの検索クエリバケットで見つかったかという
// 「収集意図のラベル」に過ぎず、実際に返ってきたURLが本当に公式ドメインであることを
// 保証しない。実機検証で、officialSiteQueries経由の検索結果にWikipedia・YouTube・
// Reddit・個人ブログ・無関係な一般企業サイト等が紛れ込み、そのままchannel="official_site"
// としてTier1判定されてしまう事例を確認したため、channelの主張だけでTier1にはしない。
// 実際のURLのホスト名を根拠に「真正な公式ドメインかどうか」を検証し、検証できない場合は
// Tier1に寄せずTier3（review_required相当）に倒す。
import type { ResearchChannel } from "@/lib/research/types";
import type { RiskLevel } from "@/lib/genres/types";
import { getGenreConfig } from "@/lib/genres/genreConfigs";

export type SourceTier = 1 | 2 | 3;

// documentationはlib/recommendation/scoreInformationValue.tsのCHANNEL_RELIABILITYで
// official_site(95)に次ぐ85点を持つが、ここでは長らく漏れておりTier3扱いになっていた
// （レビュー指摘）。news_site(80点)がTier2である以上、より信頼度の高いdocumentationも
// Tier2以上として扱うのが整合的。
const TIER2_CHANNELS: ResearchChannel[] = ["news_site", "event_site", "ticket_site", "local_media", "rss", "documentation"];

// 辞書・百科事典・個人ブログ・まとめサイト・一般掲示板等、どのトピックに対しても構造的に
// 「公式情報源」になり得ないドメイン。channelの主張や検索クエリの意図によらず、
// 常にTier1にしない（実機検証でWikipedia・Weblio・個人ブログ等の混入を確認したため）。
const NEVER_OFFICIAL_HOST_PATTERNS: RegExp[] = [
  /(^|\.)wikipedia\.org$/,
  /(^|\.)wikimedia\.org$/,
  /(^|\.)weblio\.jp$/,
  /(^|\.)kotobank\.jp$/,
  /(^|\.)dictionary\.goo\.ne\.jp$/,
  /(^|\.)gyakubiki\.net$/,
  /(^|\.)hatenablog\.(com|jp)$/,
  /(^|\.)hatena\.ne\.jp$/,
  /(^|\.)ameblo\.jp$/,
  /(^|\.)note\.com$/,
  /(^|\.)matome\.naver\.jp$/,
  /(^|\.)togetter\.com$/,
  /(^|\.)baike\.baidu\.com$/,
  /(^|\.)reddit\.com$/,
  /(^|\.)5ch\.net$/,
  /(^|\.)chiebukuro\.yahoo\.co\.jp$/,
];

// 官公庁・自治体の公式ドメイン規則（日本）。
const GOVERNMENT_HOST_PATTERNS: RegExp[] = [/\.go\.jp$/, /\.lg\.jp$/];
// city.takasaki.gunma.jpのように.lg.jpへ完全移行していない自治体公式サイトも実在するため、
// "city."/"pref."等で始まるホストも自治体公式として扱う。
const MUNICIPAL_HOST_PATTERN = /^(city|pref|town|vill)\.[a-z0-9-]+\.[a-z0-9-]+\.jp$/;

export function hostnameOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function hostMatches(host: string, targetHost: string): boolean {
  return host === targetHost || host.endsWith(`.${targetHost}`);
}

function isNeverOfficialHost(host: string): boolean {
  return NEVER_OFFICIAL_HOST_PATTERNS.some((p) => p.test(host));
}

function isGovernmentHost(host: string): boolean {
  return GOVERNMENT_HOST_PATTERNS.some((p) => p.test(host)) || MUNICIPAL_HOST_PATTERN.test(host);
}

export interface SourceTierContext {
  // トピックの公式URL（topic_classifications.official_url）。ホスト名が一致すれば
  // 真正な公式ドメインとみなす。
  topicOfficialUrl?: string | null;
  // sources.is_official=trueで既に確認済みのドメイン一覧（同一トピックで既に検証済みの情報源）。
  knownOfficialDomains?: string[];
  // "Verified professional source"判定に使うジャンルID・テキスト（タイトル・スニペット・
  // sourceName等の結合）。判定パターンはlib/genres/genreConfigs.tsの
  // GenreDetailedConfig.professionalSourcePatternsを参照。
  genreId?: string;
  professionalSourceText?: string;
}

// 動物病院等の「Verified professional source」（レビュー指摘#1）を、ドメイン文字列だけでなく
// ページの内容（施設名・診療科・監修者・所在地らしき情報等の複数シグナル）から緩やかに推定する。
// 実際のページクロール・構造化データ解析・法人番号照会までは行わないため、あくまで
// タイトル・スニペットに含まれる複数キーワードの組み合わせによる近似的なヒューリスティックであり、
// 正式な運営者・資格の確認ではない点に注意（現状のデータで可能な範囲の対応）。
// ドメイン文字列だけでの認定を避けるため、「施設種別を示す語」と「運営情報を示す語」の
// 両方が本文中に確認できる場合のみtrueにする。
//
// 判定パターンは以前genreId === "pets_animals"のハードコード分岐＋専用正規表現だったが、
// lib/genres/genreConfigs.tsのGenreDetailedConfig.professionalSourcePatternsを見るように
// 変更した（レビュー指摘）。パターン未設定のジャンルは判定を行わない（falseを返す。
// 中身の無い判定を捏造しない）。
export function isVerifiedProfessionalSource(genreId: string | undefined, text: string | undefined): boolean {
  if (!genreId || !text) return false;
  const patterns = getGenreConfig(genreId)?.professionalSourcePatterns;
  if (!patterns) return false;
  return patterns.facility.test(text) && patterns.corroborating.test(text);
}

// 実際のURLのホスト名から、真正な公式ドメインかどうかを判定する。
// 「確認できる根拠」（官公庁・自治体ドメイン、トピックのofficialUrlとの一致、
// sources.is_official由来の既知ドメイン）がある場合のみtrueにする。それ以外は
// 「公式らしく見える」だけでは判定せず、falseのままにする。
export function isVerifiedOfficialUrl(url: string | null | undefined, context: SourceTierContext = {}): boolean {
  const host = hostnameOf(url);
  if (!host) return false;
  if (isNeverOfficialHost(host)) return false;
  if (isGovernmentHost(host)) return true;
  const officialHost = hostnameOf(context.topicOfficialUrl);
  if (officialHost && hostMatches(host, officialHost)) return true;
  if (context.knownOfficialDomains?.some((d) => hostMatches(host, d.toLowerCase()))) return true;
  return false;
}

export function isBlockedFromTier1(url: string | null | undefined): boolean {
  const host = hostnameOf(url);
  return host ? isNeverOfficialHost(host) : false;
}

// channel・isOfficialSource（sources.is_official等、呼び出し側で既に確認済みの場合の
// 明示フラグ）に加えて、実際のURL（あれば）を根拠に判定する。channel="official_site"
// という収集意図の主張だけでは信用せず、isVerifiedOfficialUrlで裏付けが取れない場合は
// Tier1にしない（判定不能時はTier3に倒す。ニュース・イベント系チャネルの主張は
// Tier2として引き続き認める）。
export function computeSourceTier(
  channel: ResearchChannel | null,
  isOfficialSource: boolean,
  url: string | null | undefined = null,
  context: SourceTierContext = {},
): SourceTier {
  if (isBlockedFromTier1(url)) return 3;
  if (isOfficialSource || isVerifiedOfficialUrl(url, context)) return 1;
  if (isVerifiedProfessionalSource(context.genreId, context.professionalSourceText)) return 2;
  if (channel && TIER2_CHANNELS.includes(channel)) return 2;
  return 3;
}

// 仕様書5-7「第3層だけで確定してはいけないもの」に対応する情報タイプ集合
// （lib/genres/informationTypes.tsのコードで表現）。医療健康効果・法制度・災害・安全性・
// 営業開催・正式料金・真贋・事故原因・結果・回収対象などが該当する。
export const TIER3_ONLY_PROHIBITED_INFORMATION_TYPES: ReadonlySet<string> = new Set([
  "recall",
  "product_accident",
  "disaster",
  "evacuation",
  "warning",
  "alert",
  "infectious_disease",
  "food_poisoning",
  "adverse_effect",
  "poisoning",
  "accident",
  "defect",
  "fraud",
  "security_incident",
  "data_breach",
  "system_start",
  "system_change",
]);

export function containsTier3OnlyProhibitedInformationType(informationTypes: string[]): boolean {
  return informationTypes.some((t) => TIER3_ONLY_PROHIBITED_INFORMATION_TYPES.has(t));
}

// high・criticalリスクのジャンルはTier1を必須とする（仕様書6-3）。
export function requiresTier1(riskLevel: RiskLevel): boolean {
  return riskLevel === "critical" || riskLevel === "high";
}
