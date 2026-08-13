export type InformationType =
  | "tv_appearance"
  | "event"
  | "new_opening"
  | "release"
  | "movie"
  | "music_news"
  | "sns_trend"
  | "local_news"
  | "technology_update"
  | "creator_post"
  | "official_announcement"
  | "sale_campaign"
  | "travel_recommendation"
  | "other";

export const INFORMATION_TYPES: InformationType[] = [
  "tv_appearance",
  "event",
  "new_opening",
  "release",
  "movie",
  "music_news",
  "sns_trend",
  "local_news",
  "technology_update",
  "creator_post",
  "official_announcement",
  "sale_campaign",
  "travel_recommendation",
  "other",
];

export const INFORMATION_TYPE_LABELS: Record<InformationType, string> = {
  tv_appearance: "テレビ出演",
  event: "イベント",
  new_opening: "新規オープン",
  release: "リリース",
  movie: "映画",
  music_news: "音楽ニュース",
  sns_trend: "SNSトレンド",
  local_news: "地域ニュース",
  technology_update: "技術アップデート",
  creator_post: "発信者本人の投稿",
  official_announcement: "公式発表",
  sale_campaign: "セール・キャンペーン",
  travel_recommendation: "旅行・おでかけ",
  other: "その他",
};

// 画像の由来。元記事・公式情報を優先し、AI生成は今回は未実装（将来の拡張ポイント）。
export type ImageSourceType =
  | "article_thumbnail"
  | "article_og_image"
  | "official_site"
  | "official_sns"
  | "source_image"
  | "category_default"
  | "generated_image";

// マイページの「今日のおすすめ情報」に表示する、ユーザー向けに再構成された情報カード。
// 元記事（feed_items）そのものではなく、同じ話題の複数記事を1件にまとめた表示用データ。
export interface RecommendationCard {
  id: string;
  userId: string;
  topicId: string;
  topicName: string | null;
  informationType: InformationType;
  generatedTitle: string;
  generatedSummary: string;
  displayReason: string;
  imageUrl: string | null;
  imageAlt: string | null;
  imageSourceType: ImageSourceType;
  imageSourceUrl: string | null;
  sourceFeedItemIds: string[];
  sourceResearchResultIds: string[];
  sourceUrls: string[];
  sourceNames: string[];
  clickScore: number;
  createdAt: string;
  updatedAt: string;

  // 33ジャンルエンジン導入により追加（すべて追加専用マイグレーション、既存カラムは変更なし）。
  genreId: string | null;
  informationTypes: string[];
  crossGenreTags: string[];
  riskLevel: string | null;
  freshnessLevel: string | null;
  // 情報価値スコア（lib/recommendation/scoreInformationValue.ts）。カード生成時に計算し保存する。
  // このカラム追加前に作成されたカードはnullになりうるため、選定ロジック側でnullを
  // 「スコア不明・中立扱い」として扱う。
  informationValueScore: number | null;
  scoreBreakdown: Record<string, number> | null;
  // 同一クラスタ（同じ出来事・話題）を実行間で緩やかに同定するためのキー。
  // hide/seenによる再表示抑制の単位として使う（lib/recommendation-cards/dedupeKey.ts）。
  dedupeKey: string | null;
  // TopicUnderstanding.entityNameのコピー。同一エンティティの連続表示抑制に使う。
  entityName: string | null;
  warnings: string[];
}

// --- 将来の画像スコアリング拡張ポイント（今回は未実装） ---
// 候補画像が複数得られるようになった段階で、以下のような評価軸を追加する想定。
// 現時点ではスコアを計算する仕組みがないため、カラム・型としては追加していない。
//
//   imageRelevanceScore, imageEntityMatchScore, imageSourceTrustScore,
//   imageQualityScore, imageFreshnessScore, imageClickabilityScore, imageRiskPenalty
