// 画像候補の評価（仕様書7-7 ImageEvaluation）。実在の人物・商品・店舗・作品の
// 公式写真であるかのように生成画像を表示しないことを最優先の制約とする。
// AIによる画像内容認識は行わず（コスト・実装スコープ外）、収集メタデータ
// （収集元チャネル・公式性・記事タイトルとエンティティ名の一致・鮮度）から決定的に評価する。
import type { ResearchChannel } from "@/lib/research/types";

export interface ImageCandidate {
  url: string;
  channel: ResearchChannel | null;
  isOfficialSource: boolean;
  articleTitle: string;
  publishedAt: string | null;
  sourceImageSourceType:
    | "article_thumbnail"
    | "article_og_image"
    | "official_site"
    | "official_sns"
    | "source_image";
}

export interface ImageEvaluation {
  url: string;
  sourceType: ImageCandidate["sourceImageSourceType"];

  subjectMatchScore: number;
  freshnessScore: number;
  sourceReliabilityScore: number;
  visualQualityScore: number;
  rightsConfidenceScore: number;

  isLikelyWrongEntity: boolean;
  isLikelyOutdated: boolean;
  isPlaceholder: boolean;

  totalScore: number;
}

const CHANNEL_RIGHTS_CONFIDENCE: Partial<Record<ResearchChannel, number>> = {
  official_site: 95,
  documentation: 80,
  news_site: 65,
  event_site: 70,
  ticket_site: 70,
  local_media: 60,
  rss: 60,
  brave_search: 45,
  general_web: 40,
  social_or_video: 30,
};

const PLACEHOLDER_URL_PATTERN = /placehold\.co/i;

function clamp(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function computeAgeDays(publishedAt: string | null): number | null {
  if (!publishedAt) return null;
  const publishedMs = Date.parse(publishedAt);
  if (Number.isNaN(publishedMs)) return null;
  return Math.max(0, Math.floor((Date.now() - publishedMs) / (1000 * 60 * 60 * 24)));
}

// エンティティ名がある場合、記事タイトルにエンティティ名が含まれない画像は
// 「対象不一致の可能性」として減点する（簡易的なテキスト一致判定。画像内容そのものは見ない）。
function isLikelyWrongEntity(articleTitle: string, entityName: string | null): boolean {
  if (!entityName) return false;
  return !articleTitle.toLowerCase().includes(entityName.toLowerCase());
}

export function evaluateImage(
  candidate: ImageCandidate,
  context: { entityName: string | null; maxAgeDaysForFreshness?: number },
): ImageEvaluation {
  const ageDays = computeAgeDays(candidate.publishedAt);
  const maxAge = context.maxAgeDaysForFreshness ?? 180;
  const isLikelyOutdated = ageDays != null && ageDays > maxAge;
  const isPlaceholder = PLACEHOLDER_URL_PATTERN.test(candidate.url);
  const wrongEntity = isLikelyWrongEntity(candidate.articleTitle, context.entityName);

  const subjectMatchScore = wrongEntity ? 20 : candidate.isOfficialSource ? 90 : 65;
  const freshnessScore = ageDays == null ? 50 : clamp(100 - (ageDays / maxAge) * 100);
  const sourceReliabilityScore = candidate.channel ? (CHANNEL_RIGHTS_CONFIDENCE[candidate.channel] ?? 50) : 50;
  const visualQualityScore = 60; // 画像内容そのものは評価しない（サイズ・鮮明さ等は取得不可のため既定値）
  const rightsConfidenceScore = candidate.isOfficialSource
    ? 90
    : (candidate.channel ? (CHANNEL_RIGHTS_CONFIDENCE[candidate.channel] ?? 40) : 40);

  const wrongEntityPenalty = wrongEntity ? 40 : 0;
  const outdatedPenalty = isLikelyOutdated ? 20 : 0;
  const placeholderPenalty = isPlaceholder ? 30 : 0;

  const totalScore = clamp(
    subjectMatchScore * 0.3 +
      freshnessScore * 0.15 +
      sourceReliabilityScore * 0.25 +
      visualQualityScore * 0.1 +
      rightsConfidenceScore * 0.2 -
      wrongEntityPenalty -
      outdatedPenalty -
      placeholderPenalty,
  );

  return {
    url: candidate.url,
    sourceType: candidate.sourceImageSourceType,
    subjectMatchScore,
    freshnessScore,
    sourceReliabilityScore,
    visualQualityScore,
    rightsConfidenceScore,
    isLikelyWrongEntity: wrongEntity,
    isLikelyOutdated,
    isPlaceholder,
    totalScore,
  };
}
