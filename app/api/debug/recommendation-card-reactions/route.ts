import {
  listDebugRecommendationCardReactions,
  listDebugRecommendationCards,
  listDebugTopics,
} from "@/lib/debug-api/queries";
import { parseLimit, withDebugAuth } from "@/lib/debug-api/response";

const LOOKUP_SCAN_LIMIT = 200;

// 読み取り専用のdebug API。recommendation_cardsへのリアクション（like/bad/save/hide/click）
// の一覧と集計を返す。user_idは含めない。カードタイトル・トピック名は
// listDebugRecommendationCards/listDebugTopicsの結果と突き合わせて付与する
// （dashboard-summaryと同じ「複数のdebug_get_*結果をAPI層で結合する」パターン）。
export const GET = withDebugAuth(async (request, { supabase, apiKeyHash }) => {
  const { searchParams } = new URL(request.url);
  const limit = parseLimit(searchParams);

  const [reactions, cards, topics] = await Promise.all([
    listDebugRecommendationCardReactions(supabase, limit, apiKeyHash),
    listDebugRecommendationCards(supabase, LOOKUP_SCAN_LIMIT, apiKeyHash),
    listDebugTopics(supabase, LOOKUP_SCAN_LIMIT, apiKeyHash),
  ]);

  const cardById = new Map(cards.map((c) => [c.id, c]));
  const topicNameById = new Map(topics.map((t) => [t.id, t.name]));

  const items = reactions.map((r) => ({
    id: r.id,
    recommendationCardId: r.recommendation_card_id,
    cardTitle: cardById.get(r.recommendation_card_id)?.generated_title ?? null,
    topicId: r.topic_id,
    topicName: r.topic_id ? topicNameById.get(r.topic_id) ?? null : null,
    reactionType: r.reaction_type,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));

  const byReactionType: Record<string, number> = {};
  for (const r of reactions) {
    byReactionType[r.reaction_type] = (byReactionType[r.reaction_type] ?? 0) + 1;
  }

  const uniqueCardCountWithReaction = (reactionType: string) =>
    new Set(
      reactions
        .filter((r) => r.reaction_type === reactionType)
        .map((r) => r.recommendation_card_id),
    ).size;

  return Response.json({
    ok: true,
    resource: "recommendation_card_reactions",
    count: items.length,
    limit,
    generatedAt: new Date().toISOString(),
    summary: {
      byReactionType,
      hiddenCardsCount: uniqueCardCountWithReaction("hide"),
      savedCardsCount: uniqueCardCountWithReaction("save"),
      likedCardsCount: uniqueCardCountWithReaction("like"),
      badCardsCount: uniqueCardCountWithReaction("bad"),
    },
    data: items,
  });
});
