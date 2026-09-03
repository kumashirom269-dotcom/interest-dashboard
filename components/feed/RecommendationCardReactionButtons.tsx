"use client";

import { Button } from "@/components/ui/Button";
import {
  RECOMMENDATION_CARD_REACTION_LABELS,
  TOGGLEABLE_RECOMMENDATION_CARD_REACTION_TYPES,
  type RecommendationCardReactionType,
  type ToggleableRecommendationCardReactionType,
} from "@/lib/recommendation-card-reactions/types";

const REACTION_ICONS: Record<ToggleableRecommendationCardReactionType, string> = {
  like: "👍",
  bad: "👎",
  save: "🔖",
  hide: "🙈",
};

interface RecommendationCardReactionButtonsProps {
  activeReactions: RecommendationCardReactionType[];
  onToggle: (reactionType: ToggleableRecommendationCardReactionType) => void;
  disabled?: boolean;
}

export function RecommendationCardReactionButtons({
  activeReactions,
  onToggle,
  disabled,
}: RecommendationCardReactionButtonsProps) {
  const activeSet = new Set(activeReactions);

  return (
    // 4つのボタンが幅の狭いカード内で2行に折り返すのを避けるため、xsサイズ・flex-nowrapで
    // 必ず1行に収める（レビュー指摘）。
    <div className="flex flex-nowrap gap-1">
      {TOGGLEABLE_RECOMMENDATION_CARD_REACTION_TYPES.map((reactionType) => (
        <Button
          key={reactionType}
          size="xs"
          variant={activeSet.has(reactionType) ? "primary" : "secondary"}
          disabled={disabled}
          onClick={() => onToggle(reactionType)}
          className="shrink-0"
        >
          {REACTION_ICONS[reactionType]} {RECOMMENDATION_CARD_REACTION_LABELS[reactionType]}
        </Button>
      ))}
    </div>
  );
}
