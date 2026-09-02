import { Badge } from "@/components/ui/Badge";
import { RecommendationCardReactionButtons } from "./RecommendationCardReactionButtons";
import { INFORMATION_TYPE_LABELS } from "@/lib/recommendation-cards/types";
import type { RecommendationCard } from "@/lib/recommendation-cards/types";
import type {
  RecommendationCardReactionType,
  ToggleableRecommendationCardReactionType,
} from "@/lib/recommendation-card-reactions/types";

interface CompactRecommendationCardViewProps {
  card: RecommendationCard;
  reactionTypes: RecommendationCardReactionType[];
  onToggleReaction: (reactionType: ToggleableRecommendationCardReactionType) => void;
  onClickThrough?: () => void;
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "日時不明";
  return date.toLocaleDateString("ja-JP", { month: "2-digit", day: "2-digit" });
}

// マイページに複数件を一覧として一目で見渡せるようにする、横並び（画像・タイトル・
// 概要2行）のコンパクト表示。CompactFeedCard（feed_items用）と同じ見た目のパターンを
// RecommendationCard（AI生成カード）向けに再利用する（レビュー指摘: スマホでは
// RecommendationCardViewの1件表示が画面の大半を占め、一覧性が低い問題への対応）。
export function CompactRecommendationCardView({
  card,
  reactionTypes,
  onToggleReaction,
  onClickThrough,
}: CompactRecommendationCardViewProps) {
  const isLiked = reactionTypes.includes("like");
  const isBad = reactionTypes.includes("bad");
  const isSaved = reactionTypes.includes("save");
  const primaryUrl = card.sourceUrls[0];

  return (
    <div className="flex gap-3 rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm">
      {primaryUrl ? (
        <a
          href={primaryUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onClickThrough}
          className="shrink-0"
        >
          <CardThumbnail card={card} />
        </a>
      ) : (
        <CardThumbnail card={card} />
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-1">
          {card.topicName && (
            <Badge tone="neutral" className="px-1.5 py-0 text-[10px]">
              {card.topicName}
            </Badge>
          )}
          <Badge tone="info" className="px-1.5 py-0 text-[10px]">
            {INFORMATION_TYPE_LABELS[card.informationType]}
          </Badge>
          {isSaved && (
            <Badge tone="success" className="px-1.5 py-0 text-[10px]">
              保存済み
            </Badge>
          )}
          {isLiked && (
            <Badge tone="success" className="px-1.5 py-0 text-[10px]">
              いいね済み
            </Badge>
          )}
          {isBad && (
            <Badge tone="danger" className="px-1.5 py-0 text-[10px]">
              バッド済み
            </Badge>
          )}
        </div>

        {primaryUrl ? (
          <a
            href={primaryUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClickThrough}
            className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900 hover:underline"
          >
            {card.generatedTitle}
          </a>
        ) : (
          <span className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900">
            {card.generatedTitle}
          </span>
        )}

        <p className="line-clamp-2 text-xs leading-snug text-slate-600">
          {card.generatedSummary}
        </p>

        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-slate-400">
          <span className="truncate">
            {card.sourceNames.join("、") || "不明"}
          </span>
          <span aria-hidden>・</span>
          <span className="shrink-0">{formatDate(card.createdAt)}</span>
        </div>

        <RecommendationCardReactionButtons
          activeReactions={reactionTypes}
          onToggle={onToggleReaction}
        />
      </div>
    </div>
  );
}

function CardThumbnail({ card }: { card: RecommendationCard }) {
  if (!card.imageUrl) {
    return (
      <div className="flex h-20 w-20 items-center justify-center rounded-md bg-slate-100 text-[10px] text-slate-400">
        画像なし
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={card.imageUrl}
      alt={card.imageAlt ?? card.generatedTitle}
      className="h-20 w-20 rounded-md object-cover"
    />
  );
}
