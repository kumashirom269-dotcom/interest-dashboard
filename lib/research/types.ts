// 検索拡張型リサーチ収集（research-based collection）の中核型。
// sourcesベースの収集（公式サイト・RSS等、継続的に監視する情報源）とは別に、
// その都度AIが生成した検索クエリで見つかる個別の調査結果を扱う。

import type { InformationNeed } from "@/lib/topic-classification/types";

export type ResearchResultType =
  | "web_article"
  | "news_article"
  | "youtube_video"
  | "sns_post"
  | "official_page"
  | "blog"
  | "other";

export const RESEARCH_RESULT_TYPES: ResearchResultType[] = [
  "web_article",
  "news_article",
  "youtube_video",
  "sns_post",
  "official_page",
  "blog",
  "other",
];

export const RESEARCH_RESULT_TYPE_LABELS: Record<ResearchResultType, string> = {
  web_article: "Web記事",
  news_article: "ニュース記事",
  youtube_video: "YouTube動画",
  sns_post: "SNS投稿",
  official_page: "公式ページ",
  blog: "ブログ",
  other: "その他",
};

// 検索結果の取得元。SNS(social)・YouTube(youtube)は型としてのみ今回用意し、
// 実際のProvider実装は将来対応（今回はweb_search・official_site・mockのみ実装）。
// official_siteは検索APIではなく、lib/web-discovery/discoverLinks.tsによる
// 公式サイトの直接クロール結果を表す（AI・外部有料APIは使わない）。
export type ResearchProviderName =
  | "mock"
  | "web_search"
  | "news_search"
  | "youtube"
  | "social"
  | "official_site";

// ResearchPlanが「どの経路から情報を集めるべきか」を表すためのチャネル分類。
// providerが「実際にどのシステムで取得したか」を表すのに対し、channelは
// research_results 1件ごとに「どの観点の収集で見つかったか」を記録する
// （例: 同じweb_search providerでも、公式サイト狙いのクエリで見つかったものは
// channel="official_site"、一般的なBrave検索はchannel="brave_search"）。
export type ResearchChannel =
  | "rss"
  | "brave_search"
  | "official_site"
  | "news_site"
  | "event_site"
  | "ticket_site"
  | "local_media"
  | "social_or_video"
  | "documentation"
  | "general_web";

export const RESEARCH_CHANNELS: ResearchChannel[] = [
  "rss",
  "brave_search",
  "official_site",
  "news_site",
  "event_site",
  "ticket_site",
  "local_media",
  "social_or_video",
  "documentation",
  "general_web",
];

export interface ResearchSourcePriority {
  official: number;
  news: number;
  local: number;
  social: number;
  blog: number;
  search: number;
  rss: number;
}

export interface ResearchFreshnessPolicy {
  allowHistorical: boolean;
  preferFuture: boolean;
  maxAgeDays: number | null;
  explanation: string;
}

// 33ジャンルエンジン（lib/genres/）導入により追加。GenreDetailedConfig.sourceLayersから
// 導出される、ジャンル別の情報源要件。既存のsourcePriority（0-100の数値重み）とは別に、
// 「必須／推奨／任意／禁止」のカテゴリ分類として持たせる。
export interface ResearchSourceRequirements {
  requiredTier1Categories: string[];
  preferredTier2Categories: string[];
  optionalTier3Categories: string[];
  blockedSourceCategories: string[];
  prohibitedTier3Uses: string[];
  officialVerificationRequired: boolean;
  minimumIndependentSources: number;
}

// 1トピックあたりの収集件数上限。lib/config/aiLimits.tsのAI_LIMITSから初期値を引く
// （API節約モードの制約を超えない範囲でジャンル別に調整する）。
export interface ResearchCandidateBudget {
  maxCollectedCandidates: number;
  maxCandidatesPerSource: number;
  maxCandidatesPerInformationType: number;
  targetCardCount: number;
}

// 初期収集結果が「最新情報として薄い」と判断された場合（evaluateResearchCoverageの
// fresh_current_info_insufficient/empty_event_results）に、探索範囲を過去の共演・
// インタビュー・功績・逸話等へ広げるための方針。
// generateResearchPlan生成時点では常に無効（trigger: "none"）で初期化され、
// 初期収集後にactions.ts側で実際の収集結果を踏まえてルールベースで有効化する
// （AIへの追加問い合わせは行わない。コストを増やさないため）。
export type ResearchExpansionTrigger =
  | "fresh_current_info_insufficient"
  | "few_use_results"
  | "empty_event_results"
  | "low_activity_topic"
  | "none";

export interface ResearchExpansionPolicy {
  enabled: boolean;
  trigger: ResearchExpansionTrigger;
  expandedInformationNeeds: InformationNeed[];
  expansionQueries: string[];
  explanation: string;
}

// TopicUnderstandingの次段階として、AIが「このトピックについて何をどう探すべきか」を
// 判断した結果。RSS・Brave検索を実行する前に一度だけ生成し、以後のクエリ生成・
// 精査（vetResearchCandidates）・カード生成（generateRecommendationCard）の
// 判断材料として使い回す。research_plansテーブルへ永続化する（lib/research/planQueries.ts）。
// ただしexpansionPolicyは初期収集後に確定するため、永続化タイミングによっては
// DB上のraw_planに反映されない場合がある（既定値のまま保存される。詳細は
// app/(app)/topics/actions.tsのコメント参照）。
export interface ResearchPlan {
  topicId: string;
  topicName: string;
  userIntentSummary: string;
  primaryGoal: string;
  preferredChannels: ResearchChannel[];
  searchQueries: string[];
  officialSiteQueries: string[];
  eventQueries: string[];
  exclusionQueries: string[];
  mustIncludeSignals: string[];
  mustExcludeSignals: string[];
  sourcePriority: ResearchSourcePriority;
  freshnessPolicy: ResearchFreshnessPolicy;
  expectedResultTypes: InformationNeed[];
  notesForVetting: string;
  expansionPolicy: ResearchExpansionPolicy;

  // 33ジャンルエンジン（lib/genres/）導入により追加。参照用にprimaryGenreIdのみ複製し、
  // 詳細なジャンル設定はlib/genres/genreConfigs.tsを都度参照する（重複保持しない）。
  primaryGenreId: string;
  informationTypes: string[];
  sourceRequirements: ResearchSourceRequirements;
  candidateBudget: ResearchCandidateBudget;
  preferredCardTypes: string[];
  safetyConstraints: string[];
}

// research_plansテーブルへ保存された後の形（id・createdAtが確定した状態）。
// debug APIやfollow-up検索の紐づけ（research_results.research_plan_id）にはこのidを使う。
export interface PersistedResearchPlan extends ResearchPlan {
  id: string;
  createdAt: string;
}

// ページ本文の軽量取得（lib/web-discovery/fetchWebPageSummary.ts）の結果ステータス。
// research_results.fetch_statusにそのまま保存する（未取得の行はnullのまま）。
export type WebPageFetchStatus = "success" | "failed" | "skipped";

// AIが生成する、1トピックあたりの検索観点。
export interface ResearchQuery {
  query: string;
  purpose: string;
  priority: number;
  expectedResultType: ResearchResultType;
}

// research_resultsテーブルに対応するドメイン型。
export interface ResearchResult {
  id: string;
  topicId: string;
  query: string;
  provider: ResearchProviderName;
  resultType: ResearchResultType;
  title: string;
  url: string;
  snippet: string | null;
  sourceName: string | null;
  sourceDomain: string | null;
  authorName: string | null;
  publishedAt: string | null;
  discoveredAt: string;
  rankingPosition: number | null;
  popularityScore: number | null;
  credibilityScore: number | null;
  relevanceScore: number | null;
  freshnessScore: number | null;
  imageUrl: string | null;
  rawMetadata: unknown;
  // どの収集チャネル（ResearchPlan.preferredChannels）の一環として見つかったか。
  // 未設定（null）は、ResearchPlan導入前の結果、またはチャネル分類ができなかった場合。
  channel: ResearchChannel | null;
  // 生成元のResearchPlan（永続化されている場合）。プラン生成自体が失敗し
  // フォールバックプランが未保存のまま使われた場合はnullになりうる。
  researchPlanId: string | null;
  // 初期収集ではなく、evaluateResearchCoverageによる不足判断を受けた補助検索で
  // 見つかった結果かどうか。
  isFollowUp: boolean;
  // isFollowUpがtrueの場合、どの不足観点を補うための検索だったかの説明。
  followUpReason: string | null;
  // fetchWebPageSummaryによる軽量なページ要約取得結果。取得を試みていない行はnull。
  fetchedPageTitle: string | null;
  fetchedPageDescription: string | null;
  fetchedImageUrl: string | null;
  fetchStatus: WebPageFetchStatus | null;

  // 33ジャンルエンジン導入により追加。トピックのTopicUnderstandingから複製する
  // （候補精査・クラスタリング・カード生成・Debug APIの間でジャンル情報が失われないため）。
  genreId: string | null;
  informationTypes: string[];
  crossGenreTags: string[];
  riskLevel: string | null;
  // 三層構造（lib/research-review/sourceTier.ts）上の格付け。収集時にchannel・公式性から
  // 機械的に算出する。
  sourceTier: 1 | 2 | 3 | null;
  // Tier3単独では確定できない情報タイプに該当する等、追加確認が必要と判定された場合true。
  requiresVerification: boolean;
  verificationIssues: string[];
  temporalStatus: "upcoming" | "ongoing" | "recent" | "ended" | "expired" | "unknown" | "evergreen";
}

// insertTopicPreferenceCategories等と同じ「まだDBに保存されていない状態」のプレビュー型。
// ジャンル関連フィールドは、Provider実装（トピックのclassificationを知らない）が
// 直接埋めることを期待せず、呼び出し元（app/(app)/topics/actions.ts）がinsertResearchResults
// 呼び出し直前にenrichResearchResultsWithGenreInfo()で付与できるよう、ここでは任意にしている。
export type NewResearchResult = Omit<
  ResearchResult,
  | "id"
  | "discoveredAt"
  | "genreId"
  | "informationTypes"
  | "crossGenreTags"
  | "riskLevel"
  | "sourceTier"
  | "requiresVerification"
  | "verificationIssues"
  | "temporalStatus"
> & {
  discoveredAt?: string;
  genreId?: string | null;
  informationTypes?: string[];
  crossGenreTags?: string[];
  riskLevel?: string | null;
  sourceTier?: 1 | 2 | 3 | null;
  requiresVerification?: boolean;
  verificationIssues?: string[];
  temporalStatus?: ResearchResult["temporalStatus"];
};

// Provider抽象化。将来WebSearchApiProvider（Google/Bing/Brave/SerpAPI等）・
// YouTubeProvider・SocialSearchProviderに差し替えられるようにする。
export interface ResearchProvider {
  readonly name: ResearchProviderName;
  // resultsLimitは1クエリあたりに取得する件数の上限（省略時はProvider既定値）。
  // API節約モード（lib/config/aiLimits.ts）から呼び出し元が指定する。
  search(
    query: ResearchQuery,
    topicId: string,
    resultsLimit?: number,
  ): Promise<NewResearchResult[]>;
}
