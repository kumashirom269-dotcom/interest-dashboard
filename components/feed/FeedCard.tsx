import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ReactionButtons } from "./ReactionButtons";
import type { FeedItem, ReactionType } from "@/types/domain";

interface FeedCardProps {
  feedItem: FeedItem;
  sourceScore: number;
  topicName?: string;
  reactionTypes: ReactionType[];
  onToggleReaction: (reactionType: ReactionType) => void;
  reactionsDisabled?: boolean;
}

function formatDate(isoString: string): string {
  if (!isoString) return "日時不明";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "日時不明";
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function FeedCard({
  feedItem,
  sourceScore,
  topicName,
  reactionTypes,
  onToggleReaction,
  reactionsDisabled,
}: FeedCardProps) {
  const isSaved = reactionTypes.includes("save");

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold text-slate-900">
          {feedItem.title}
        </h3>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
          <span>{feedItem.source_name}</span>
          <span aria-hidden>・</span>
          <span>{formatDate(feedItem.published_at)}</span>
          {topicName && <Badge tone="neutral">{topicName}</Badge>}
          <Badge tone="info">収集元スコア {sourceScore}</Badge>
          <Badge tone="success">関連度 {feedItem.relevance_score}</Badge>
          {isSaved && <Badge tone="info">保存済み</Badge>}
        </div>
      </div>

      {feedItem.summary && (
        <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
          {feedItem.summary}
        </p>
      )}

      {feedItem.ai_comment && (
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <span className="font-medium text-slate-700">
            なぜ関係ありそうか：
          </span>
          {feedItem.ai_comment}
        </div>
      )}

      {feedItem.related_topics.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {feedItem.related_topics.map((topic) => (
            <Badge key={topic} tone="neutral">
              {topic}
            </Badge>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <ReactionButtons
          activeReactions={reactionTypes}
          onToggle={onToggleReaction}
          disabled={reactionsDisabled}
        />
        <a
          href={feedItem.url}
          target="_blank"
          rel="noopener noreferrer"
          className="whitespace-nowrap text-sm font-medium text-slate-900 underline underline-offset-2 hover:text-slate-600"
        >
          元記事を開く →
        </a>
      </div>
    </Card>
  );
}
