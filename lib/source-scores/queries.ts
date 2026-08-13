import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReactionType } from "@/types/domain";

export const SOURCE_SCORE_MIN = 0;
export const SOURCE_SCORE_MAX = 100;
export const SOURCE_SCORE_DEFAULT = 50;

const REACTION_SCORE_DELTA: Record<ReactionType, number> = {
  useful: 5,
  save: 4,
  more_from_source: 6,
  not_relevant: -5,
  less_from_source: -6,
  hide: -8,
};

export type ScoreEventDirection = "add" | "remove";

export interface ScoreEvent {
  reactionType: ReactionType;
  direction: ScoreEventDirection;
  reason: string;
  reactionId: string | null;
}

export function calculateReactionScoreDelta(
  reactionType: ReactionType,
  direction: ScoreEventDirection,
): number {
  const base = REACTION_SCORE_DELTA[reactionType];
  return direction === "add" ? base : -base;
}

export function clampSourceScore(score: number): number {
  return Math.min(SOURCE_SCORE_MAX, Math.max(SOURCE_SCORE_MIN, score));
}

interface ApplySourceScoreDeltaParams {
  supabase: SupabaseClient;
  userId: string;
  sourceId: string;
  // research_results由来のカードリアクションには対応するfeed_itemが無いため、
  // その場合はnullを渡す（source_score_logs.feed_item_idはnullable）。
  feedItemId: string | null;
  events: ScoreEvent[];
}

// リアクションの追加・削除で発生したscoreEventsを順番に適用し、
// sources.source_scoreの更新とsource_score_logsへの記録を行う。
// 複数イベント（例: 排他リアクションの入れ替え）は1回のトグル操作内で連続して積み上げる。
export async function applySourceScoreDelta({
  supabase,
  userId,
  sourceId,
  feedItemId,
  events,
}: ApplySourceScoreDeltaParams): Promise<void> {
  if (events.length === 0) return;

  const { data: source, error: sourceError } = await supabase
    .from("sources")
    .select("id, source_score")
    .eq("id", sourceId)
    .eq("user_id", userId)
    .single();

  if (sourceError) throw sourceError;

  let currentScore: number = source.source_score ?? SOURCE_SCORE_DEFAULT;

  const logs = events.map((event) => {
    const rawDelta = calculateReactionScoreDelta(
      event.reactionType,
      event.direction,
    );
    const scoreBefore = currentScore;
    const scoreAfter = clampSourceScore(scoreBefore + rawDelta);
    currentScore = scoreAfter;

    return {
      user_id: userId,
      source_id: sourceId,
      feed_item_id: feedItemId,
      reaction_id: event.reactionId,
      reaction_type: event.reactionType,
      // クランプ後に実際に反映された差分を記録する（生の差分ではない）
      score_delta: scoreAfter - scoreBefore,
      score_before: scoreBefore,
      score_after: scoreAfter,
      reason: event.reason,
    };
  });

  const { error: updateError } = await supabase
    .from("sources")
    .update({ source_score: currentScore })
    .eq("id", sourceId)
    .eq("user_id", userId);

  if (updateError) throw updateError;

  const { error: logError } = await supabase
    .from("source_score_logs")
    .insert(logs);

  if (logError) throw logError;
}
