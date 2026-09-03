"use client";

import { useState } from "react";
import { CompactFeedCard } from "@/components/feed/CompactFeedCard";
import { CompactRecommendationCardView } from "@/components/feed/CompactRecommendationCardView";
import {
  toggleReaction,
  toggleRecommendationCardReactionAction,
} from "@/app/(app)/mypage/actions";
import type { FeedItemWithMeta } from "@/lib/feed-items/queries";
import type { RecommendationCard } from "@/lib/recommendation-cards/types";
import type {
  RecommendationCardReactionType,
  ToggleableRecommendationCardReactionType,
} from "@/lib/recommendation-card-reactions/types";
import type { ReactionType } from "@/types/domain";

interface SavedPageClientProps {
  feedItems: FeedItemWithMeta[];
  recommendationCards: RecommendationCard[];
  cardReactionsByCard: Record<string, RecommendationCardReactionType[]>;
}

export function SavedPageClient({
  feedItems: initialFeedItems,
  recommendationCards: initialRecommendationCards,
  cardReactionsByCard: initialCardReactionsByCard,
}: SavedPageClientProps) {
  const [feedItems, setFeedItems] = useState(initialFeedItems);
  const [recommendationCards, setRecommendationCards] = useState(
    initialRecommendationCards,
  );
  const [cardReactionsByCard, setCardReactionsByCard] = useState(
    initialCardReactionsByCard,
  );
  const [error, setError] = useState<string | null>(null);

  async function handleToggleReaction(
    feedItemId: string,
    reactionType: ReactionType,
  ) {
    setError(null);
    const previous = feedItems;
    try {
      const updated = await toggleReaction(feedItemId, reactionType);
      if (!updated.includes("save") || updated.includes("hide")) {
        setFeedItems((prev) => prev.filter((item) => item.id !== feedItemId));
      } else {
        setFeedItems((prev) =>
          prev.map((item) =>
            item.id === feedItemId
              ? { ...item, reactionTypes: updated, is_saved: true }
              : item,
          ),
        );
      }
    } catch (e) {
      setFeedItems(previous);
      setError(
        e instanceof Error ? e.message : "リアクションの保存に失敗しました",
      );
    }
  }

  // save解除（またはhide）で一覧から即座に消す。挙動はhandleToggleReaction（feed_item側）と揃えている。
  async function handleToggleCardReaction(
    recommendationCardId: string,
    reactionType: ToggleableRecommendationCardReactionType,
  ) {
    setError(null);
    const previousCards = recommendationCards;
    const previousReactions = cardReactionsByCard;
    try {
      const updated = await toggleRecommendationCardReactionAction(
        recommendationCardId,
        reactionType,
      );
      if (!updated.includes("save") || updated.includes("hide")) {
        setRecommendationCards((prev) =>
          prev.filter((card) => card.id !== recommendationCardId),
        );
      }
      setCardReactionsByCard((prev) => ({ ...prev, [recommendationCardId]: updated }));
    } catch (e) {
      setRecommendationCards(previousCards);
      setCardReactionsByCard(previousReactions);
      setError(
        e instanceof Error ? e.message : "リアクションの保存に失敗しました",
      );
    }
  }

  const isEmpty = feedItems.length === 0 && recommendationCards.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold text-slate-900">保存した記事</h1>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {isEmpty && (
        <p className="text-sm text-slate-500">
          保存済みの記事はまだありません。気になる記事の保存ボタンを押すと、ここに表示されます。
        </p>
      )}

      {recommendationCards.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-slate-700">
            保存したおすすめ情報
          </h2>
          <div className="flex flex-col gap-2">
            {recommendationCards.map((card) => (
              <CompactRecommendationCardView
                key={card.id}
                card={card}
                reactionTypes={cardReactionsByCard[card.id] ?? []}
                onToggleReaction={(type) => handleToggleCardReaction(card.id, type)}
              />
            ))}
          </div>
        </div>
      )}

      {feedItems.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-slate-700">
            保存した個別記事
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {feedItems.map((item) => (
              <CompactFeedCard
                key={item.id}
                feedItem={item}
                topicName={item.topicName ?? undefined}
                reactionTypes={item.reactionTypes}
                onToggleReaction={(type) => handleToggleReaction(item.id, type)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
