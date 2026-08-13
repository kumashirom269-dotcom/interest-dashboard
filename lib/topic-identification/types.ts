// トピック登録時の「対象特定ゲート」。ユーザーが入力したトピック名から、
// サービス側が「何について情報を集めるのか」を明確に特定できるまでは、
// 収集カテゴリ提案・正式登録へ進ませないための判定結果。

export type IdentificationStatus =
  | "identified"
  | "needs_selection"
  | "needs_more_info"
  | "not_identifiable";

// トピックの「種別」。以前はentity_topic（1つの固有対象を追う）しか想定していなかったが、
// 「旬な果物」のような固有対象を持たないテーマ型・季節型トピックも登録できるようにするため、
// 上位概念として導入する。identifiedEntity.topicKindに実際に確定した種別が入り、
// CandidateEntity.topicKindには「その候補を選んだ場合の種別」が入る。
// ambiguous_topicは選択前の一時的な状態を表す値であり、ユーザーが候補を選んだ後に
// 確定するtopicKindとしては使われない（最終的にはこの値を除くいずれかになる）。
export type TopicKind =
  | "entity_topic"
  | "theme_topic"
  | "seasonal_topic"
  | "local_discovery_topic"
  | "recommendation_topic"
  | "trend_topic"
  | "learning_topic"
  | "ambiguous_topic"
  | "unknown";

export const TOPIC_KINDS: TopicKind[] = [
  "entity_topic",
  "theme_topic",
  "seasonal_topic",
  "local_discovery_topic",
  "recommendation_topic",
  "trend_topic",
  "learning_topic",
  "ambiguous_topic",
  "unknown",
];

export const TOPIC_KIND_LABELS: Record<TopicKind, string> = {
  entity_topic: "特定対象",
  theme_topic: "テーマ型",
  seasonal_topic: "季節型",
  local_discovery_topic: "地域探索型",
  recommendation_topic: "おすすめ・比較型",
  trend_topic: "トレンド型",
  learning_topic: "学習型",
  ambiguous_topic: "曖昧語（要選択）",
  unknown: "不明",
};

export type RequestedAdditionalInfo =
  | "youtube_channel_url"
  | "official_site_url"
  | "sns_url"
  | "alias"
  | "activity_genre"
  | "description";

export const REQUESTED_ADDITIONAL_INFO_LABELS: Record<RequestedAdditionalInfo, string> = {
  youtube_channel_url: "YouTubeチャンネルURL",
  official_site_url: "公式サイトURL",
  sns_url: "公式SNSのURL",
  alias: "よく使われている別名",
  activity_genre: "活動ジャンル",
  description: "詳しい説明",
};

export interface IdentifiedEntity {
  name: string;
  entityType: string;
  description: string;
  canonicalUrl?: string | null;
  officialUrl?: string | null;
  youtubeChannelUrl?: string | null;
  confidence: number;
  // このトピックの種別。entity_topic以外（theme_topic/seasonal_topic等）の場合、
  // nameには固有対象名ではなく正規化したテーマ名（例:「旬の果物」）が入る。
  topicKind: TopicKind;
}

// needs_selectionで提示する解釈候補。1つの候補が「1つの意味＝1つのtopicKind」に対応する
// （例:「テレビ」の候補には、テーマ型の「テレビ番組・芸能情報」とentity_topic型の
// 「特定の芸能人のテレビ出演」が混在しうる）。
export interface CandidateEntity {
  name: string;
  entityType: string;
  description: string;
  officialUrl?: string | null;
  youtubeChannelUrl?: string | null;
  confidence: number;
  topicKind: TopicKind;
  // この候補を選んだ場合に扱うintentCategory（TopicIntentCategoryの値。循環importを
  // 避けるためここでは文字列のまま持ち、classifyTopic側で正式な型へ正規化する）。
  intentCategory?: string;
  // ユーザーの入力そのものより分かりやすい正式なトピック名がある場合（例:「テレビ」→
  // 「テレビ番組・芸能情報」）、この候補を選んだ際に使う推奨トピック名。
  suggestedTopicName?: string;
  // この候補を選んでもまだ対象を特定できない場合（例:「好きな芸能人のテレビ出演」）にtrue。
  // trueの場合、そのまま確定させずsuggestedQuestionをユーザーに確認する。
  needsMoreInfo?: boolean;
  suggestedQuestion?: string;
}

export interface TopicIdentificationResult {
  inputText: string;
  normalizedTopicName: string | null;
  identificationStatus: IdentificationStatus;
  identifiedEntity: IdentifiedEntity | null;
  candidateEntities: CandidateEntity[];
  clarificationQuestion: string | null;
  requestedAdditionalInfo: RequestedAdditionalInfo[];
  canProceedToPreferenceSelection: boolean;
  reason: string;
}

// 追加情報の確認は最大2回まで（初回解析を含めると最大3回のAI呼び出し）。
// これを超えても特定できない場合は、AIの判定によらずnot_identifiableへ強制する。
export const MAX_CLARIFICATION_ROUNDS = 2;
