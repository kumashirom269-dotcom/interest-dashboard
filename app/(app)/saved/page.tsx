import {
  getFeedItemsForUser,
  filterSavedFeedItems,
  filterByPreferredLanguage,
} from "@/lib/feed-items/queries";
import { getPreferredFeedLanguageForUser } from "@/lib/profiles/queries";
import {
  getRecommendationCardsForUser,
} from "@/lib/recommendation-cards/queries";
import { getRecommendationCardReactionsForUser } from "@/lib/recommendation-card-reactions/queries";
import { SavedPageClient } from "./SavedPageClient";

export default async function SavedPage() {
  const [feedItems, preferredLanguage, recommendationCards, cardReactionsByCard] =
    await Promise.all([
      getFeedItemsForUser(),
      getPreferredFeedLanguageForUser(),
      getRecommendationCardsForUser(),
      getRecommendationCardReactionsForUser(),
    ]);

  const savedFeedItems = filterByPreferredLanguage(
    filterSavedFeedItems(feedItems),
    preferredLanguage,
  );

  // おすすめ情報カードの「保存」は、feed_itemsのreactionsとは別のテーブル
  // （recommendation_card_reactions）で管理されているため、こちらも別途フィルタする
  // （レビュー指摘: カードを保存しても保存済み一覧に出てこない問題への対応）。
  const savedRecommendationCards = recommendationCards.filter((card) =>
    (cardReactionsByCard[card.id] ?? []).includes("save"),
  );

  return (
    <div className="mx-auto w-full max-w-5xl">
      <SavedPageClient
        feedItems={savedFeedItems}
        recommendationCards={savedRecommendationCards}
        cardReactionsByCard={cardReactionsByCard}
      />
    </div>
  );
}
