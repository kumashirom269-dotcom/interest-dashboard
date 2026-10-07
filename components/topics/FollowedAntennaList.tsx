"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { unfollowTopic } from "@/app/(app)/topics/actions";
import type { FollowedTopic } from "@/app/(app)/topics/actions";

interface FollowedAntennaListProps {
  initialFollowedTopics: FollowedTopic[];
}

// 「自分のアンテナ」とは別枠で、フォロー中の公開アンテナを一覧表示する
// （指示書8章: フォロー中のアンテナは作成者が収集した結果をそのまま参照するため、
// ここでは一覧と解除操作のみを持ち、独自の収集は行わない）。
export function FollowedAntennaList({ initialFollowedTopics }: FollowedAntennaListProps) {
  const [followedTopics, setFollowedTopics] = useState(initialFollowedTopics);
  const [pendingTopicId, setPendingTopicId] = useState<string | null>(null);

  if (followedTopics.length === 0) return null;

  async function handleUnfollow(topicId: string) {
    setPendingTopicId(topicId);
    try {
      await unfollowTopic(topicId);
      setFollowedTopics((prev) => prev.filter((t) => t.topicId !== topicId));
    } finally {
      setPendingTopicId(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-slate-700">フォロー中のアンテナ</h2>
      <div className="flex flex-col gap-2">
        {followedTopics.map((topic) => (
          <Card key={topic.topicId} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              {topic.slug ? (
                <Link
                  href={`/a/${topic.slug}`}
                  className="truncate text-sm font-medium text-slate-900 underline-offset-2 hover:underline"
                >
                  {topic.title}
                </Link>
              ) : (
                <p className="truncate text-sm font-medium text-slate-900">{topic.title}</p>
              )}
              {topic.description && (
                <p className="truncate text-xs text-slate-500">{topic.description}</p>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                size="sm"
                variant="ghost"
                disabled={pendingTopicId === topic.topicId}
                onClick={() => handleUnfollow(topic.topicId)}
              >
                フォロー解除
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
