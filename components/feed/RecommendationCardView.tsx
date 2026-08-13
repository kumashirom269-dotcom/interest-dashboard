import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { RecommendationCardReactionButtons } from "./RecommendationCardReactionButtons";
import { INFORMATION_TYPE_LABELS } from "@/lib/recommendation-cards/types";
import type { RecommendationCard } from "@/lib/recommendation-cards/types";
import type {
  RecommendationCardReactionType,
  ToggleableRecommendationCardReactionType,
} from "@/lib/recommendation-card-reactions/types";

interface RecommendationCardViewProps {
  card: RecommendationCard;
  reactionTypes: RecommendationCardReactionType[];
  onToggleReaction: (reactionType: ToggleableRecommendationCardReactionType) => void;
  onClickThrough?: () => void;
}

function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "日時不明";
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RecommendationCardView({
  card,
  reactionTypes,
  onToggleReaction,
  onClickThrough,
}: RecommendationCardViewProps) {
  const isLiked = reactionTypes.includes("like");
  const isBad = reactionTypes.includes("bad");
  const isSaved = reactionTypes.includes("save");

  return (
    <Card className="flex flex-col gap-3 overflow-hidden p-0">
      <div className="aspect-video w-full overflow-hidden bg-slate-100">
        {card.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.imageUrl}
            alt={card.imageAlt ?? card.generatedTitle}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
            画像なし
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {card.topicName && <Badge tone="neutral">{card.topicName}</Badge>}
          <Badge tone="info">
            {INFORMATION_TYPE_LABELS[card.informationType]}
          </Badge>
          {isSaved && <Badge tone="success">保存済み</Badge>}
          {isLiked && <Badge tone="success">いいね済み</Badge>}
          {isBad && <Badge tone="danger">バッド済み</Badge>}
        </div>

        <h3 className="text-base font-semibold text-slate-900">
          {card.sourceUrls[0] ? (
            <a
              href={card.sourceUrls[0]}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClickThrough}
              className="hover:underline"
            >
              {card.generatedTitle}
            </a>
          ) : (
            card.generatedTitle
          )}
        </h3>

        <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
          {card.generatedSummary}
        </p>

        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <span className="font-medium text-slate-700">
            おすすめ理由：
          </span>
          {card.displayReason}
        </p>

        <div className="flex flex-col gap-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>情報源：{card.sourceNames.join("、") || "不明"}</span>
            <span aria-hidden>・</span>
            <span>確認日時：{formatDateTime(card.createdAt)}</span>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {card.sourceUrls.map((url, index) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClickThrough}
                className="font-medium text-slate-900 underline underline-offset-2 hover:text-slate-600"
              >
                元記事{card.sourceUrls.length > 1 ? `${index + 1}` : ""}を開く →
              </a>
            ))}
          </div>
        </div>

        <RecommendationCardReactionButtons
          activeReactions={reactionTypes}
          onToggle={onToggleReaction}
        />
      </div>
    </Card>
  );
}
