import { createClient } from "@/lib/supabase/server";
import { applySourceScoreDelta, type ScoreEvent } from "@/lib/source-scores/queries";
import type { ReactionType } from "@/types/domain";

const EXCLUSIVE_PAIRS: Partial<Record<ReactionType, ReactionType>> = {
  useful: "not_relevant",
  not_relevant: "useful",
  more_from_source: "less_from_source",
  less_from_source: "more_from_source",
};

export type ReactionsByFeedItem = Record<string, ReactionType[]>;

export async function getReactionsByFeedItemForUser(): Promise<ReactionsByFeedItem> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("reactions")
    .select("feed_item_id, reaction_type")
    .eq("user_id", user.id);

  if (error) throw error;

  const map: ReactionsByFeedItem = {};
  for (const row of data ?? []) {
    const list = map[row.feed_item_id] ?? [];
    list.push(row.reaction_type as ReactionType);
    map[row.feed_item_id] = list;
  }
  return map;
}

// 処理の流れ：
// 1. ログイン中ユーザーの記事か確認し、source_idを取得
// 2. 同じreaction_typeが既に付いていれば削除（トグルOFF）してscoreEventsに記録
// 3. 付いていなければ、排他リアクションが付いていれば先に削除してscoreEventsに記録し、
//    その後新しいreactionをinsertしてscoreEventsに記録
// 4. scoreEventsに基づいてsources.source_scoreを更新し、source_score_logsに履歴を保存
// 5. 最新のreactionTypesを返す
//
// リアクションの増減とスコア更新は同一関数内で連続して実行するが、
// Supabase JSでは複数テーブルにまたがる完全なトランザクションは組めないため、
// 「リアクション保存は成功したがスコア更新は失敗した」場合はエラーをthrowして呼び出し元に伝える。
export async function toggleReactionForUser(
  feedItemId: string,
  reactionType: ReactionType,
): Promise<ReactionType[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const userId = user.id;

  const { data: feedItem, error: feedItemError } = await supabase
    .from("feed_items")
    .select("id, source_id")
    .eq("id", feedItemId)
    .eq("user_id", userId)
    .single();

  if (feedItemError) throw feedItemError;

  const scoreEvents: ScoreEvent[] = [];

  const { data: existing, error: existingError } = await supabase
    .from("reactions")
    .select("id")
    .eq("user_id", userId)
    .eq("feed_item_id", feedItemId)
    .eq("reaction_type", reactionType)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing) {
    const { error: deleteError } = await supabase
      .from("reactions")
      .delete()
      .eq("id", existing.id);
    if (deleteError) throw deleteError;

    scoreEvents.push({
      reactionType,
      direction: "remove",
      reason: `reaction_removed: ${reactionType}`,
      // 削除済みのreactionsレコードを参照するとFK制約違反(23503)になるためnull
      reactionId: null,
    });
  } else {
    const opposite = EXCLUSIVE_PAIRS[reactionType];
    if (opposite) {
      const { data: deletedOpposite, error: deleteOppositeError } =
        await supabase
          .from("reactions")
          .delete()
          .eq("user_id", userId)
          .eq("feed_item_id", feedItemId)
          .eq("reaction_type", opposite)
          .select("id");
      if (deleteOppositeError) throw deleteOppositeError;

      if (deletedOpposite && deletedOpposite.length > 0) {
        scoreEvents.push({
          reactionType: opposite,
          direction: "remove",
          reason: `exclusive_reaction_removed: ${opposite}`,
          // 削除済みのreactionsレコードを参照するとFK制約違反(23503)になるためnull
          reactionId: null,
        });
      }
    }

    const { data: inserted, error: insertError } = await supabase
      .from("reactions")
      .insert({
        user_id: userId,
        feed_item_id: feedItemId,
        source_id: feedItem.source_id,
        reaction_type: reactionType,
      })
      .select("id")
      .single();
    if (insertError) throw insertError;

    scoreEvents.push({
      reactionType,
      direction: "add",
      reason: `reaction_added: ${reactionType}`,
      reactionId: inserted.id,
    });
  }

  await applySourceScoreDelta({
    supabase,
    userId,
    sourceId: feedItem.source_id,
    feedItemId,
    events: scoreEvents,
  });

  const { data: current, error: currentError } = await supabase
    .from("reactions")
    .select("reaction_type")
    .eq("user_id", userId)
    .eq("feed_item_id", feedItemId);

  if (currentError) throw currentError;

  return (current ?? []).map((r) => r.reaction_type as ReactionType);
}
