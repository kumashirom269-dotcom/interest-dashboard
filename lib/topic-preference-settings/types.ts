export type TargetLevel = "beginner" | "intermediate" | "advanced";

export const TARGET_LEVELS: TargetLevel[] = [
  "beginner",
  "intermediate",
  "advanced",
];

export const TARGET_LEVEL_LABELS: Record<TargetLevel, string> = {
  beginner: "初心者向け",
  intermediate: "中級者向け",
  advanced: "上級者向け",
};

export type DesiredContentType =
  | "news"
  | "tutorial"
  | "trend"
  | "youtube"
  | "sns"
  | "official"
  | "personal_story"
  | "idea";

export const DESIRED_CONTENT_TYPES: DesiredContentType[] = [
  "news",
  "tutorial",
  "trend",
  "youtube",
  "sns",
  "official",
  "personal_story",
  "idea",
];

export const DESIRED_CONTENT_TYPE_LABELS: Record<DesiredContentType, string> = {
  news: "ニュース",
  tutorial: "チュートリアル・解説",
  trend: "トレンド・話題",
  youtube: "YouTube動画",
  sns: "SNSでの話題",
  official: "公式情報",
  personal_story: "個人の体験談",
  idea: "アイデア・発想",
};

export type DisplayTone = "easy" | "practical" | "deep" | "casual";

export const DISPLAY_TONES: DisplayTone[] = [
  "easy",
  "practical",
  "deep",
  "casual",
];

export const DISPLAY_TONE_LABELS: Record<DisplayTone, string> = {
  easy: "やさしく",
  practical: "実践的に",
  deep: "深く掘り下げて",
  casual: "カジュアルに",
};

export type ExcludedTendency = "too_technical" | "too_old" | "too_promotional";

export const EXCLUDED_TENDENCIES: ExcludedTendency[] = [
  "too_technical",
  "too_old",
  "too_promotional",
];

export const EXCLUDED_TENDENCY_LABELS: Record<ExcludedTendency, string> = {
  too_technical: "専門的すぎる内容",
  too_old: "古い情報",
  too_promotional: "宣伝色が強い内容",
};

// トピックごとに「AIにどう情報を選んでほしいか」を指定する好み設定。
// topic_classifications（AIが推定した情報）と対になる、ユーザー指定の設定。
// DBテーブル名はtopic_preference_settings（旧topic_preferencesからリネーム。
// topic_preferencesという名前は、トピック登録時にAIが生成するカテゴリ選択機能
// （lib/topic-preferences/）に明け渡した）。
// 現時点ではDBへの保存のみを行い、実際にfeed_itemsの評価・フィルタには使用していない
// （整理・評価層は追加のAI API呼び出しを伴うため、別途設計・費用感の合意を得てから実装する）。
export interface TopicPreferenceSettings {
  topicId: string;
  targetLevel: TargetLevel;
  desiredContentTypes: DesiredContentType[];
  displayTone: DisplayTone;
  excludedTendencies: ExcludedTendency[];
  supplementaryNotes: string;
  userFocus: string;
}

export const DEFAULT_TOPIC_PREFERENCE_SETTINGS: Omit<
  TopicPreferenceSettings,
  "topicId"
> = {
  targetLevel: "intermediate",
  desiredContentTypes: [],
  displayTone: "practical",
  excludedTendencies: [],
  supplementaryNotes: "",
  userFocus: "",
};
