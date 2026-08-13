"use client";

import { Button } from "@/components/ui/Button";
import { REACTION_LABELS, type ReactionType } from "@/types/domain";

const REACTION_ORDER: ReactionType[] = [
  "useful",
  "not_relevant",
  "save",
  "hide",
  "more_from_source",
  "less_from_source",
];

const REACTION_ICONS: Record<ReactionType, string> = {
  useful: "👍",
  not_relevant: "👎",
  save: "🔖",
  hide: "🙈",
  more_from_source: "📈",
  less_from_source: "📉",
};

interface ReactionButtonsProps {
  activeReactions: ReactionType[];
  onToggle: (reactionType: ReactionType) => void;
  disabled?: boolean;
  // コンパクトな一覧カード用に、アイコンのみの小さいボタンで表示する
  compact?: boolean;
}

export function ReactionButtons({
  activeReactions,
  onToggle,
  disabled,
  compact = false,
}: ReactionButtonsProps) {
  const activeSet = new Set(activeReactions);

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1">
        {REACTION_ORDER.map((reactionType) => (
          <button
            key={reactionType}
            type="button"
            title={REACTION_LABELS[reactionType]}
            aria-label={REACTION_LABELS[reactionType]}
            aria-pressed={activeSet.has(reactionType)}
            disabled={disabled}
            onClick={() => onToggle(reactionType)}
            className={`flex h-6 w-6 items-center justify-center rounded text-xs leading-none transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              activeSet.has(reactionType)
                ? "bg-slate-900 text-white"
                : "bg-slate-100 hover:bg-slate-200"
            }`}
          >
            {REACTION_ICONS[reactionType]}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {REACTION_ORDER.map((reactionType) => (
        <Button
          key={reactionType}
          size="sm"
          variant={activeSet.has(reactionType) ? "primary" : "secondary"}
          disabled={disabled}
          onClick={() => onToggle(reactionType)}
        >
          {REACTION_LABELS[reactionType]}
        </Button>
      ))}
    </div>
  );
}
