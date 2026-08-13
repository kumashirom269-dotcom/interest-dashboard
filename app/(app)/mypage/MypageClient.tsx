"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CompactFeedCard } from "@/components/feed/CompactFeedCard";
import { RecommendationCardView } from "@/components/feed/RecommendationCardView";
import {
  recordRecommendationCardClickAction,
  toggleReaction,
  toggleRecommendationCardReactionAction,
} from "./actions";
import type { FeedItemWithMeta } from "@/lib/feed-items/queries";
import type { RecommendationCard } from "@/lib/recommendation-cards/types";
import { selectDashboardCards } from "@/lib/recommendation/selectDashboardCards";
import type {
  RecommendationCardReactionType,
  ToggleableRecommendationCardReactionType,
} from "@/lib/recommendation-card-reactions/types";
import type { ReactionType } from "@/types/domain";

interface TopicOption {
  id: string;
  name: string;
}

interface MypageClientProps {
  feedItems: FeedItemWithMeta[];
  recommendationCards: RecommendationCard[];
  cardReactionsByCard: Record<string, RecommendationCardReactionType[]>;
  topics: TopicOption[];
  researchApiConfigured: boolean;
  isDevelopment: boolean;
}

// マイページの初期表示件数は原則12件（仕様書7-4）。高品質な候補が12件未満の場合は
// 無理に埋めない。「さらに表示」でLOAD_MORE_STEP件ずつ拡張できる。
const INITIAL_DISPLAY_COUNT = 12;
const LOAD_MORE_STEP = 12;

function sortFeedItems(items: FeedItemWithMeta[]): FeedItemWithMeta[] {
  return [...items].sort((a, b) => {
    const dateDiff =
      new Date(b.published_at || 0).getTime() -
      new Date(a.published_at || 0).getTime();
    if (dateDiff !== 0) return dateDiff;

    const scoreDiff = b.sourceScore - a.sourceScore;
    if (scoreDiff !== 0) return scoreDiff;

    return b.relevance_score - a.relevance_score;
  });
}

export function MypageClient({
  feedItems: initialFeedItems,
  recommendationCards: initialRecommendationCards,
  cardReactionsByCard: initialCardReactionsByCard,
  topics,
  researchApiConfigured,
  isDevelopment,
}: MypageClientProps) {
  const [feedItems, setFeedItems] = useState(initialFeedItems);
  const [recommendationCards, setRecommendationCards] = useState(
    initialRecommendationCards,
  );
  const [cardReactionsByCard, setCardReactionsByCard] = useState(
    initialCardReactionsByCard,
  );
  const [selectedTopicId, setSelectedTopicIdState] = useState<string | "all">(
    "all",
  );
  const [error, setError] = useState<string | null>(null);
  const [showFeedItems, setShowFeedItems] = useState(false);
  const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY_COUNT);

  // クリック済み（既読/seen相当）・save済みカードは、未読カードより選定順位を下げる
  // （lib/recommendation/selectDashboardCards.tsのreadCardIds）。
  // saveは「保存一覧では維持するが、通常フィードへ何度も再表示しない」という方針のうち、
  // 後段（通常フィードでの再表示抑制）をここで実現する。専用の保存一覧UIは未実装（残課題）。
  const readCardIds = useMemo(() => {
    const ids = new Set<string>();
    for (const [cardId, types] of Object.entries(cardReactionsByCard)) {
      if (types.includes("click") || types.includes("save")) ids.add(cardId);
    }
    return ids;
  }, [cardReactionsByCard]);

  function setSelectedTopicId(id: string | "all") {
    setSelectedTopicIdState(id);
    setDisplayCount(INITIAL_DISPLAY_COUNT);
  }

  const filteredRecommendationCards = useMemo(() => {
    const pool =
      selectedTopicId === "all"
        ? recommendationCards
        : recommendationCards.filter((card) => card.topicId === selectedTopicId);
    // トピック絞り込み時は同一トピック内なので、トピック単位の上限は実質無効化する。
    return selectDashboardCards(pool, {
      targetCount: displayCount,
      ...(selectedTopicId === "all" ? {} : { maxPerTopic: Number.MAX_SAFE_INTEGER }),
      readCardIds,
    });
  }, [recommendationCards, selectedTopicId, displayCount, readCardIds]);

  // 「さらに表示」ボタンの要否判定用に、現在の選定件数より多い候補が残っているか確認する
  // （低品質カードで無理に埋めていないため、次のLOAD_MORE_STEP分を試算して比較する）。
  const hasMoreToShow = useMemo(() => {
    const pool =
      selectedTopicId === "all"
        ? recommendationCards
        : recommendationCards.filter((card) => card.topicId === selectedTopicId);
    const expanded = selectDashboardCards(pool, {
      targetCount: displayCount + LOAD_MORE_STEP,
      ...(selectedTopicId === "all" ? {} : { maxPerTopic: Number.MAX_SAFE_INTEGER }),
      readCardIds,
    });
    return expanded.length > filteredRecommendationCards.length;
  }, [recommendationCards, selectedTopicId, displayCount, readCardIds, filteredRecommendationCards.length]);

  // hide済みカードはサーバー側（page.tsx）で既に除外して渡しているが、
  // このセッション中にユーザーがhideを押した場合は即座に画面から消す。
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
      setCardReactionsByCard((prev) => ({ ...prev, [recommendationCardId]: updated }));
      if (updated.includes("hide")) {
        setRecommendationCards((prev) =>
          prev.filter((card) => card.id !== recommendationCardId),
        );
      }
    } catch (e) {
      setRecommendationCards(previousCards);
      setCardReactionsByCard(previousReactions);
      setError(
        e instanceof Error ? e.message : "リアクションの保存に失敗しました",
      );
    }
  }

  // クリックの記録は表示に影響しないため、失敗してもUI操作をブロックしない
  // （fire-and-forget。エラーはコンソールにのみ残す）。
  function handleCardClickThrough(recommendationCardId: string) {
    recordRecommendationCardClickAction(recommendationCardId).catch((e) => {
      console.error("クリックの記録に失敗しました", e);
    });
  }

  async function handleToggleReaction(
    feedItemId: string,
    reactionType: ReactionType,
  ) {
    setError(null);
    const previous = feedItems;
    try {
      const updated = await toggleReaction(feedItemId, reactionType);
      setFeedItems((prev) => {
        if (updated.includes("hide")) {
          return prev.filter((item) => item.id !== feedItemId);
        }
        return prev.map((item) =>
          item.id === feedItemId
            ? {
                ...item,
                reactionTypes: updated,
                is_saved: updated.includes("save"),
              }
            : item,
        );
      });
    } catch (e) {
      setFeedItems(previous);
      setError(
        e instanceof Error ? e.message : "リアクションの保存に失敗しました",
      );
    }
  }

  const filteredItems = useMemo(() => {
    const items =
      selectedTopicId === "all"
        ? feedItems
        : feedItems.filter((item) => item.topic_id === selectedTopicId);
    return sortFeedItems(items);
  }, [feedItems, selectedTopicId]);

  if (feedItems.length === 0 && recommendationCards.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
        <div className="flex flex-col gap-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
          <p>まだ表示できるおすすめ情報がありません。</p>
          <p className="text-xs text-slate-500">
            登録直後の場合は、情報収集の準備中です。検索APIが未設定の場合、RSSがないトピックでは情報が表示されないことがあります。
          </p>
        </div>
        {isDevelopment && !researchApiConfigured && (
          <p className="rounded-md border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            開発用メモ：BRAVE_SEARCH_API_KEY が未設定のため、検索拡張リサーチはMockProviderで動作しています。Mock結果はカード生成対象外です。
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={selectedTopicId === "all" ? "primary" : "secondary"}
          onClick={() => setSelectedTopicId("all")}
        >
          すべて
        </Button>
        {topics.map((topic) => (
          <Button
            key={topic.id}
            size="sm"
            variant={selectedTopicId === topic.id ? "primary" : "secondary"}
            onClick={() => setSelectedTopicId(topic.id)}
          >
            {topic.name}
          </Button>
        ))}
      </div>

      {filteredRecommendationCards.length === 0 && isDevelopment && !researchApiConfigured && (
        <p className="rounded-md border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          開発用メモ：おすすめ情報カードはまだありません。BRAVE_SEARCH_API_KEY
          が未設定のため検索拡張リサーチはMockProviderで動作しており、Mock結果はカード生成対象外です。RSS記事が取得できたトピックのみカードが作られます。
        </p>
      )}

      {filteredRecommendationCards.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-slate-700">
            おすすめ情報（自動収集）
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredRecommendationCards.map((card) => (
              <RecommendationCardView
                key={card.id}
                card={card}
                reactionTypes={cardReactionsByCard[card.id] ?? []}
                onToggleReaction={(type) => handleToggleCardReaction(card.id, type)}
                onClickThrough={() => handleCardClickThrough(card.id)}
              />
            ))}
          </div>
          {hasMoreToShow && (
            <div className="flex justify-center pt-1">
              <Button
                variant="secondary"
                onClick={() => setDisplayCount((prev) => prev + LOAD_MORE_STEP)}
              >
                さらに表示
              </Button>
            </div>
          )}
        </div>
      )}

      {filteredItems.length === 0 ? (
        recommendationCards.length === 0 && (
          <p className="text-sm text-slate-500">
            このトピックに紐づく記事はまだありません。
          </p>
        )
      ) : filteredRecommendationCards.length > 0 ? (
        // おすすめカードがある場合、個別記事の生一覧は主役ではないため既定で折りたたむ
        // （元記事はカード内のリンクからも辿れる）。
        <div className="flex flex-col gap-2">
          <Button size="sm" variant="ghost" onClick={() => setShowFeedItems((v) => !v)}>
            {showFeedItems
              ? "個別記事一覧を隠す"
              : `個別記事一覧を表示する（${filteredItems.length}件・開発用）`}
          </Button>
          {showFeedItems && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {filteredItems.map((item) => (
                <CompactFeedCard
                  key={item.id}
                  feedItem={item}
                  topicName={item.topicName ?? undefined}
                  reactionTypes={item.reactionTypes}
                  onToggleReaction={(type) => handleToggleReaction(item.id, type)}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        // カードがまだ無いトピックでは、個別記事だけが情報源のため通常表示する。
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-slate-700">個別記事一覧</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {filteredItems.map((item) => (
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
