import { Badge } from "@/components/ui/Badge";
import { ReactionButtons } from "./ReactionButtons";
import { GENERIC_DEFAULT_IMAGE } from "@/lib/images/resolveArticleImage";
import type { FeedItem, ReactionType } from "@/types/domain";

interface CompactFeedCardProps {
  feedItem: FeedItem;
  topicName?: string;
  reactionTypes: ReactionType[];
  onToggleReaction: (reactionType: ReactionType) => void;
}

function formatDate(isoString: string): string {
  if (!isoString) return "日時不明";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "日時不明";
  return date.toLocaleDateString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
  });
}

export function CompactFeedCard({
  feedItem,
  topicName,
  reactionTypes,
  onToggleReaction,
}: CompactFeedCardProps) {
  const title = feedItem.ai_title || feedItem.title;
  const summary = feedItem.ai_summary || feedItem.summary;
  const imageUrl = feedItem.image_url || GENERIC_DEFAULT_IMAGE;
  const isSaved = reactionTypes.includes("save");

  return (
    <div className="flex gap-3 rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm">
      <a
        href={feedItem.url}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={title}
          className="h-20 w-20 rounded-md object-cover"
        />
      </a>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <a
          href={feedItem.url}
          target="_blank"
          rel="noopener noreferrer"
          className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900 hover:underline"
        >
          {title}
        </a>

        {summary && (
          <p className="line-clamp-2 text-xs leading-snug text-slate-600">
            {summary}
          </p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-slate-400">
          <span className="truncate">{feedItem.source_name}</span>
          <span aria-hidden>・</span>
          <span className="shrink-0">{formatDate(feedItem.published_at)}</span>
          {topicName && (
            <>
              <span aria-hidden>・</span>
              <span className="truncate">{topicName}</span>
            </>
          )}
          {isSaved && (
            <Badge tone="info" className="px-1.5 py-0 text-[10px]">
              保存済み
            </Badge>
          )}
        </div>

        <ReactionButtons
          activeReactions={reactionTypes}
          onToggle={onToggleReaction}
          compact
        />
      </div>
    </div>
  );
}
