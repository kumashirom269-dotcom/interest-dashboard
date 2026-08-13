// 画像選定（仕様書7-7）。候補画像をevaluateImageでスコア化し、最良のものを採用する。
// 一定スコア未満、対象不一致の疑いが強いもの、プレースホルダーURLは画像なし扱いにする。
// 生成画像（AI画像生成）は今回も未実装のまま（実在対象の捏造リスクがあるため、
// lib/images/resolveArticleImage.tsと同じ既定方針を維持する）。
import { evaluateImage, type ImageCandidate, type ImageEvaluation } from "@/lib/images/evaluateImages";
import { getCategoryDefaultImage } from "@/lib/images/resolveArticleImage";
import type { TopicEntityType } from "@/lib/topic-classification/types";
import type { ImageSourceType } from "@/lib/recommendation-cards/types";
import type { TopicKind } from "@/lib/topic-identification/types";

export interface SelectedCardImage {
  imageUrl: string | null;
  imageSourceType: ImageSourceType;
  imageSourceUrl: string | null;
  evaluation: ImageEvaluation | null;
}

// 一定スコア未満なら画像なしにする（仕様書7-7「一定スコア未満なら画像なしにしてください」）。
const MIN_ACCEPTABLE_SCORE = 40;

// entity_topic（特定の実在対象を追うトピック）で、かつ「写真として写りうる」実在対象
// （人物・グループ・企業・場所等）の場合、汎用カテゴリ画像（placehold.coの色分けラベル）を
// 「対象そのものの写真」と誤認されるリスクがあるため使わない。この場合は画像候補が
// 無ければ画像なしにする（仕様書「誤認のおそれがある場合はカテゴリ共通画像ではなく
// 画像なしにしてください」準拠）。
const PHOTOGRAPHABLE_REAL_ENTITY_TYPES: TopicEntityType[] = [
  "person",
  "group",
  "artist",
  "sports_team",
  "place",
  "company",
  "product",
];

function riskOfMisrepresentation(topicKind: TopicKind | undefined, entityType: TopicEntityType | null): boolean {
  if (topicKind !== "entity_topic") return false;
  if (!entityType) return false;
  return PHOTOGRAPHABLE_REAL_ENTITY_TYPES.includes(entityType);
}

export function selectCardImage(
  candidates: ImageCandidate[],
  context: {
    entityName: string | null;
    entityType: TopicEntityType | null;
    topicKind?: TopicKind;
    maxAgeDaysForFreshness?: number;
  },
): SelectedCardImage {
  const evaluations = candidates
    .map((c) => evaluateImage(c, context))
    .filter((e) => !e.isPlaceholder && !e.isLikelyWrongEntity && e.totalScore >= MIN_ACCEPTABLE_SCORE)
    .sort((a, b) => b.totalScore - a.totalScore);

  if (evaluations.length === 0) {
    if (riskOfMisrepresentation(context.topicKind, context.entityType)) {
      // 実在人物・企業・場所等の「対象そのものの写真」に見えるカテゴリ画像は使わず、
      // 画像なしにする（誤認防止を画像ありのメリットより優先する）。
      return { imageUrl: null, imageSourceType: "category_default", imageSourceUrl: null, evaluation: null };
    }
    return {
      imageUrl: getCategoryDefaultImage(context.entityType),
      imageSourceType: "category_default",
      imageSourceUrl: null,
      evaluation: null,
    };
  }

  const best = evaluations[0];
  return {
    imageUrl: best.url,
    imageSourceType: best.sourceType,
    imageSourceUrl: best.url,
    evaluation: best,
  };
}
