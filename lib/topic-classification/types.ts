import type { SourceType } from "@/types/domain";
import type { IdentificationStatus, TopicKind } from "@/lib/topic-identification/types";

export type TopicEntityType =
  | "person"
  | "group"
  | "artist"
  | "sports_team"
  | "place"
  | "company"
  | "product"
  | "technology"
  | "anime_manga_game"
  | "food"
  | "lifestyle"
  | "local_topic"
  | "news_topic"
  | "money"
  | "health"
  | "education"
  | "job"
  | "event"
  | "content_series"
  | "community"
  | "unknown";

export const TOPIC_ENTITY_TYPES: TopicEntityType[] = [
  "person",
  "group",
  "artist",
  "sports_team",
  "place",
  "company",
  "product",
  "technology",
  "anime_manga_game",
  "food",
  "lifestyle",
  "local_topic",
  "news_topic",
  "money",
  "health",
  "education",
  "job",
  "event",
  "content_series",
  "community",
  "unknown",
];

export const TOPIC_ENTITY_TYPE_LABELS: Record<TopicEntityType, string> = {
  person: "人物",
  group: "グループ",
  artist: "アーティスト",
  sports_team: "スポーツチーム",
  place: "場所",
  company: "企業",
  product: "商品",
  technology: "技術",
  anime_manga_game: "アニメ・漫画・ゲーム",
  food: "食",
  lifestyle: "ライフスタイル",
  local_topic: "地域トピック",
  news_topic: "ニューストピック",
  money: "お金",
  health: "健康",
  education: "教育",
  job: "仕事",
  event: "イベント",
  content_series: "作品・コンテンツシリーズ",
  community: "コミュニティ",
  unknown: "不明",
};

// トピックの情報がどれくらいの頻度で更新価値を持つか（マイページ表示のたびに毎回
// AIで再収集するのではなく、この鮮度プロファイルに応じた最短更新間隔で再収集するために使う）。
export type FreshnessProfile =
  | "breaking"
  | "high_frequency"
  | "daily"
  | "seasonal"
  | "evergreen";

export const FRESHNESS_PROFILES: FreshnessProfile[] = [
  "breaking",
  "high_frequency",
  "daily",
  "seasonal",
  "evergreen",
];

export const FRESHNESS_PROFILE_LABELS: Record<FreshnessProfile, string> = {
  breaking: "速報（災害・緊急）",
  high_frequency: "高頻度更新（芸能・株価等）",
  daily: "通常（日次程度）",
  seasonal: "季節・期間限定イベント",
  evergreen: "普遍的（学習・趣味等）",
};

export interface FreshnessProfileDefaults {
  minRefreshIntervalMinutes: number;
  defaultCardTtlHours: number;
}

// 各プロファイルの最短更新間隔・カード表示期限の目安（ChatGPTとの検討で決めたレンジの中間値）。
// AIの判定を尊重しつつ、後からルールで一律上書きできるようにこの定数テーブルに集約している。
export const FRESHNESS_PROFILE_DEFAULTS: Record<FreshnessProfile, FreshnessProfileDefaults> = {
  breaking: { minRefreshIntervalMinutes: 20, defaultCardTtlHours: 12 },
  high_frequency: { minRefreshIntervalMinutes: 120, defaultCardTtlHours: 48 },
  daily: { minRefreshIntervalMinutes: 1440, defaultCardTtlHours: 120 },
  seasonal: { minRefreshIntervalMinutes: 2880, defaultCardTtlHours: 336 },
  evergreen: { minRefreshIntervalMinutes: 10080, defaultCardTtlHours: 1080 },
};

// ユーザーがこのトピックで求めている情報の「時期の向き」。
// freshness_profileが「どれくらいの頻度で情報が更新されるか」を表すのに対し、
// time_intentは「ユーザーがそもそも過去・現在・未来のどの時期の情報を求めているか」を表す。
// 例:「THE ALFEE」→ current_or_future（直近〜今後の情報を優先）、
//    「THE ALFEEの過去」「THE ALFEE 1980年代」→ historical（古い情報を除外しない）。
// これにより、リサーチ精査ステップ（lib/ai/vetResearchCandidates.ts）で
// 「情報が古いから除外する」という判断をそのトピックに適用してよいかどうかを決められる。
export type TimeIntent =
  | "current_or_future"
  | "recent"
  | "historical"
  | "specific_period"
  | "evergreen";

export const TIME_INTENTS: TimeIntent[] = [
  "current_or_future",
  "recent",
  "historical",
  "specific_period",
  "evergreen",
];

export const TIME_INTENT_LABELS: Record<TimeIntent, string> = {
  current_or_future: "現在・今後を重視",
  recent: "直近の話題を重視",
  historical: "過去の情報を許可",
  specific_period: "特定時期を重視",
  evergreen: "時期を問わない",
};

// トピックの「情報ニーズの中身」を表す上位概念（topic intent / topic understanding）。
// time_intent（時期の向き）とは独立した軸で、「何について」「どんな情報を求めているか」
// をAIが構造化したもの。入力文字列をそのまま検索キーワード扱いせず、対象エンティティと
// 情報ニーズを分離して保持することで、検索クエリ生成・リサーチ精査・カード生成が
// ユーザーの意図に沿った判断をできるようにする。
export type TopicIntentCategory =
  | "news"
  | "event"
  | "artist"
  | "local"
  | "learning"
  | "technical"
  | "entertainment"
  | "food"
  | "shopping"
  | "career"
  | "finance"
  | "health"
  | "evergreen_knowledge"
  | "other";

export const TOPIC_INTENT_CATEGORIES: TopicIntentCategory[] = [
  "news",
  "event",
  "artist",
  "local",
  "learning",
  "technical",
  "entertainment",
  "food",
  "shopping",
  "career",
  "finance",
  "health",
  "evergreen_knowledge",
  "other",
];

export type InformationNeed =
  | "latest_news"
  | "upcoming_events"
  | "detailed_event_info"
  | "release_info"
  | "media_appearance"
  | "tickets"
  | "local_openings"
  | "how_to"
  | "beginner_learning"
  | "deep_research"
  | "reviews"
  | "recommendations"
  | "trend_summary"
  | "historical_background"
  | "official_announcements"
  | "other";

export const INFORMATION_NEEDS: InformationNeed[] = [
  "latest_news",
  "upcoming_events",
  "detailed_event_info",
  "release_info",
  "media_appearance",
  "tickets",
  "local_openings",
  "how_to",
  "beginner_learning",
  "deep_research",
  "reviews",
  "recommendations",
  "trend_summary",
  "historical_background",
  "official_announcements",
  "other",
];

export type AudienceLevel = "beginner" | "general" | "enthusiast" | "expert" | "unknown";

export const AUDIENCE_LEVELS: AudienceLevel[] = [
  "beginner",
  "general",
  "enthusiast",
  "expert",
  "unknown",
];

export interface TopicLocationIntent {
  required: boolean;
  locationText: string | null;
}

export interface TopicAmbiguityInfo {
  isAmbiguous: boolean;
  reason: string | null;
  candidateMeanings: string[];
}

// トピック理解の構造化結果。TopicClassification.understandingとして保持する。
// entityType（このtopicUnderstanding内のもの）は、TopicClassification.entityType
// （TOPIC_ENTITY_TYPESの固定enum）とは別物で、AIが自由に書ける短い説明的ラベル
// （例:"artist_group"）。DB列名も既存のentity_type列と衝突しないよう
// understanding_entity_typeにしている（lib/topic-classification/queries.ts参照）。
export interface TopicUnderstanding {
  // トピックの種別（entity_topic/theme_topic/seasonal_topic等）。対象特定ゲート
  // （lib/ai/identifyTopicEntity.ts）で確定した場合はその値が必ず優先される
  // （lib/ai/classifyTopic.ts自身の判定はそれを上書きしない。
  // app/(app)/topics/actions.tsのpreviewTopicRegistration参照）。
  //
  // topicKindとprimaryGenreId系は直交する2軸。topicKindは「どのような性質・
  // 集め方のトピックか」（特定対象／テーマ型／季節型／地域探索型等）、
  // primaryGenreIdは「何についての情報か」（音楽／グルメ等、lib/genres/参照）を表す。
  // 例:「THE ALFEE」→ topicKind: entity_topic, primaryGenreId: "music"
  //    「旬な果物」→ topicKind: seasonal_topic, primaryGenreId: "gourmet_dining"
  topicKind: TopicKind;
  normalizedTopic: string;
  entityName: string | null;
  entityType: string | null;
  category: TopicIntentCategory;
  informationNeeds: InformationNeed[];

  // 33ジャンル分類（lib/genres/definitions.tsのgenreId）。主ジャンルは必須1件、
  // 強い関連ジャンルは最大2件、補助ジャンルは必要に応じて。
  // TopicClassification.parentCategory/subCategory/detailCategory（自由記述、非推奨）は
  // これらの値からlib/genres/genreConfigs.tsのderiveLegacyCategoryFields()で
  // 後方互換のために自動生成される。
  primaryGenreId: string;
  secondaryGenreIds: string[];
  auxiliaryGenreIds: string[];
  // ジャンル横断の情報タイプコード（lib/genres/informationTypes.ts参照）。
  informationTypes: string[];
  // 横断領域の自由記述タグ（例:"seasonal_food"）。実際の横断ルール適用は
  // appliedCrossGenreRuleIdsで決定的に行う（lib/genres/crossGenreRules.ts参照）。
  crossGenreTags: string[];
  // findApplicableCrossGenreRules()により決定的ロジックで適用が決まった
  // CrossGenreResearchRule.ruleId一覧（AIには生成させない）。
  appliedCrossGenreRuleIds: string[];

  prioritySignals: string[];
  negativeSignals: string[];
  searchHints: string[];
  sourceHints: string[];
  audienceLevel: AudienceLevel;
  locationIntent: TopicLocationIntent;
  ambiguity: TopicAmbiguityInfo;
  userIntentSummary: string;
}

// トピック名が曖昧な場合に、AIが提示する「もしかしてこちらですか？」の確認候補。
export interface TopicCandidateEntity {
  label: string;
  entityType: TopicEntityType;
  parentCategory: string;
  subCategory: string;
  detailCategory?: string;
  description: string;
  confidence: number;
}

// AIによるトピック分類結果。
// 将来的にtopic_classificationsテーブルへ保存する際も、この型をほぼそのまま流用できるようにしている。
export interface TopicClassification {
  topicName: string;
  entityType: TopicEntityType;
  parentCategory: string;
  subCategory: string;
  detailCategory: string;
  summary: string;
  intentTags: string[];
  recommendedSourceTypes: SourceType[];
  searchKeywords: string[];
  confidence: number;
  needsUserConfirmation: boolean;
  ambiguityReason?: string;
  candidateEntities: TopicCandidateEntity[];
  researchHints: string[];
  notes?: string;
  // トピック登録時の対象特定ゲート（lib/topic-identification/）で特定できた場合に埋まる。
  // 手動の「AIで分類」再実行等、対象特定ゲートを経由しない経路ではundefinedのままにし、
  // DB保存時に既存の値を上書きしないようにする（lib/topic-classification/queries.ts参照）。
  identificationStatus?: IdentificationStatus;
  canonicalUrl?: string | null;
  officialUrl?: string | null;
  youtubeChannelUrl?: string | null;
  freshnessProfile: FreshnessProfile;
  freshnessReason: string;
  minRefreshIntervalMinutes: number;
  defaultCardTtlHours: number;
  timeIntent: TimeIntent;
  timeIntentReason: string;
  understanding: TopicUnderstanding;
}

// confidenceがこの値未満、entityTypeがunknown、
// またはnotesに「Web調査が望ましい」が含まれる場合はWeb調査候補とする。
// 今回はWeb調査自体は未実装（researchTopicOnWeb等は将来追加）だが、
// UI上で「確認が必要」の判定にはこのしきい値を使う。
export const WEB_RESEARCH_CONFIDENCE_THRESHOLD = 0.85;

export function shouldResearchOnWeb(classification: TopicClassification): boolean {
  if (classification.entityType === "unknown") return true;
  if (classification.confidence < WEB_RESEARCH_CONFIDENCE_THRESHOLD) return true;
  if (classification.candidateEntities.length > 1) return true;
  if (classification.notes?.includes("Web調査が望ましい")) return true;
  return false;
}

// --- 将来のWeb調査拡張ポイント（今回は未実装） ---
// 分類の自信が低い、またはentityTypeがunknownの場合にWeb調査を行い、
// 分類結果や収集元候補生成に反映する想定。関数シグネチャの目安：
//
//   researchTopicOnWeb(topicName: string): Promise<{ officialUrls: string[]; notes: string }>
//   classifyTopicWithResearch(topicName: string): Promise<TopicClassification>
//   findOfficialSourcesForTopic(classification: TopicClassification): Promise<string[]>
//   findRssCandidatesForTopic(classification: TopicClassification): Promise<string[]>
//
// classifyTopic()の戻り値（TopicClassification）をそのまま入力に取れるようにしてあるため、
// 上記を追加する際もlib/ai/classifyTopic.tsやlib/topic-classification/配下に
// 自然に追加できる想定。
