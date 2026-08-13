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
    <div className="flex flex-wrap gap-1.5">
      {TOGGLEABLE_RECOMMENDATION_CARD_REACTION_TYPES.map((reactionType) => (
        <Button
          key={reactionType}
          size="sm"
          variant={activeSet.has(reactionType) ? "primary" : "secondary"}
          disabled={disabled}
          onClick={() => onToggle(reactionType)}
        >
          {REACTION_ICONS[reactionType]} {RECOMMENDATION_CARD_REACTION_LABELS[reactionType]}
        </Button>
      ))}
    </div>
  );
}
