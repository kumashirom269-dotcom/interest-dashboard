"use server";

import { revalidatePath } from "next/cache";
import { toggleReactionForUser } from "@/lib/reactions/queries";
import {
  recordRecommendationCardClick,
  toggleRecommendationCardReaction,
} from "@/lib/recommendation-card-reactions/queries";
import type { RecommendationCardReactionType, ToggleableRecommendationCardReactionType } from "@/lib/recommendation-card-reactions/types";
import type { ReactionType } from "@/types/domain";

export async function toggleReaction(
  feedItemId: string,
  reactionType: ReactionType,
): Promise<ReactionType[]> {
  const result = await toggleReactionForUser(feedItemId, reactionType);
  revalidatePath("/mypage");
  revalidatePath("/saved");
  revalidatePath("/sources");
  return result;
}

export async function toggleRecommendationCardReactionAction(
  recommendationCardId: string,
  reactionType: ToggleableRecommendationCardReactionType,
): Promise<RecommendationCardReactionType[]> {
  const result = await toggleRecommendationCardReaction(recommendationCardId, reactionType);
  revalidatePath("/mypage");
  return result;
}

// クリックは画面表示に影響しないため、feed_item側のようにページ全体をrevalidateしない
// （毎クリックでの再取得を避け、UIの応答性を優先する）。
export async function recordRecommendationCardClickAction(
  recommendationCardId: string,
): Promise<void> {
  await recordRecommendationCardClick(recommendationCardId);
}
