import { createClient } from "@/lib/supabase/server";
import {
  getFeedItemsForUser,
  filterVisibleFeedItems,
  filterByPreferredLanguage,
} from "@/lib/feed-items/queries";
import { getPreferredFeedLanguageForUser } from "@/lib/profiles/queries";
import { getRecommendationCardsForUser } from "@/lib/recommendation-cards/queries";
import { getRecommendationCardReactionsForUser } from "@/lib/recommendation-card-reactions/queries";
import { isResearchApiKeyConfigured } from "@/lib/research/getResearchProvider";
import { MypageClient } from "./MypageClient";

export default async function MyPage() {
  const [feedItems, preferredLanguage, recommendationCards] = await Promise.all([
    getFeedItemsForUser(),
    getPreferredFeedLanguageForUser(),
    getRecommendationCardsForUser(),
  ]);

  // recommendation_card_reactionsテーブルはmigration 0036で追加したばかりで、
  // 適用前は取得に失敗する（relation does not exist）。既存のマイページ表示を
  // 壊さないよう、失敗時は「リアクションなし」として扱いフォールバックする。
  let cardReactionsByCard: Awaited<ReturnType<typeof getRecommendationCardReactionsForUser>> =
    {};
  try {
    cardReactionsByCard = await getRecommendationCardReactionsForUser();
  } catch {
    cardReactionsByCard = {};
  }

  const visibleFeedItems = filterByPreferredLanguage(
    filterVisibleFeedItems(feedItems),
    preferredLanguage,
  );

  // hide済みのおすすめカードは表示しない（最優先の反映事項）。
  const visibleRecommendationCards = recommendationCards.filter(
    (card) => !(cardReactionsByCard[card.id] ?? []).includes("hide"),
  );

  const supabase = await createClient();
  const { data: topics, error } = await supabase
    .from("topics")
    .select("id, name")
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (
    <div className="mx-auto w-full max-w-[1800px]">
      <MypageClient
        key={preferredLanguage}
        feedItems={visibleFeedItems}
        recommendationCards={visibleRecommendationCards}
        cardReactionsByCard={cardReactionsByCard}
        topics={topics ?? []}
        researchApiConfigured={isResearchApiKeyConfigured()}
        isDevelopment={process.env.NODE_ENV !== "production"}
      />
    </div>
  );
}
