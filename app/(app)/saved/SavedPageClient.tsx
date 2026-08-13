"use client";

import { useState } from "react";
import { CompactFeedCard } from "@/components/feed/CompactFeedCard";
import { toggleReaction } from "@/app/(app)/mypage/actions";
import type { FeedItemWithMeta } from "@/lib/feed-items/queries";
import type { ReactionType } from "@/types/domain";

interface SavedPageClientProps {
  feedItems: FeedItemWithMeta[];
}

export function SavedPageClient({
  feedItems: initialFeedItems,
}: SavedPageClientProps) {
  const [feedItems, setFeedItems] = useState(initialFeedItems);
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

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-slate-900">保存した記事</h1>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {feedItems.length === 0 ? (
        <p className="text-sm text-slate-500">
          保存済みの記事はまだありません。気になる記事の保存ボタンを押すと、ここに表示されます。
        </p>
      ) : (
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
      )}
    </div>
  );
}
