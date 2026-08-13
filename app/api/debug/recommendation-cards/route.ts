import { listDebugRecommendationCards } from "@/lib/debug-api/queries";
import { debugSuccess, parseLimit, withDebugAuth } from "@/lib/debug-api/response";

// 読み取り専用のdebug API。おすすめカード（recommendation_cards）の一覧を返す。
// source_feed_item_ids / source_research_result_ids の中身から、そのカードが
// RSS由来か検索由来か（両方混ざっている場合はmixed）を判定したoriginフィールドを
// 付与している（開発時にどちらの経路で作られたカードか一目で分かるようにするため）。
export const GET = withDebugAuth(async (request, { supabase, apiKeyHash }) => {
  const { searchParams } = new URL(request.url);
  const limit = parseLimit(searchParams);

  const items = await listDebugRecommendationCards(supabase, limit, apiKeyHash);

  const itemsWithOrigin = items.map((item) => {
    const hasFeedItems = (item.source_feed_item_ids?.length ?? 0) > 0;
    const hasResearchResults = (item.source_research_result_ids?.length ?? 0) > 0;
    const origin =
      hasFeedItems && hasResearchResults
        ? "mixed"
        : hasFeedItems
          ? "rss"
          : hasResearchResults
            ? "web_search"
            : "unknown";

    return { ...item, origin };
  });

  return debugSuccess("recommendation_cards", itemsWithOrigin, limit);
});
