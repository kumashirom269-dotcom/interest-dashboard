import { createClient } from "@/lib/supabase/server";
import {
  aggregateReactionSignals,
  type AggregatableReactionType,
  type ReactionSignalEvent,
  type ReactionSignalSummary,
} from "@/lib/reactions/aggregateReactionSignals";

// reactions（feed_item単位）とrecommendation_card_reactions（カード単位）の両方を取得し、
// トピックのジャンル・カードの情報タイプ・収集元と突き合わせてReactionSignalEventへ変換した上で
// aggregateReactionSignals()に渡す。呼び出し元（generateResearchPlan・scoreInformationValue・
// selectDashboardCards）が実際にこの集計結果を使うことで、リアクション学習を実処理へ接続する。
//
// "bad"（カードリアクション）と"not_relevant"（旧feed_itemリアクション）は、どちらも
// ここで"dislike"へ正規化する。"useful"/"like"は"like"へ、"save"はそのまま。
// "seen"に相当する明示的なリアクション型はこのプロジェクトには存在しないため、
// "click"（クリック済み＝閲覧済み）を代替信号として扱うが、click自体はプラス/マイナス
// どちらの学習にも使わない（マイナス学習に使わないという仕様書7-2の方針を、
// そもそも集計対象に含めないことで実現する）。
// 同一カード・同一記事に複数のリアクション（例: 過去のlikeが残ったままhideした場合）が
// 併存し得るため、集計に使うのは最も優先度の高い1件のみにする（レビュー指摘#8）。
// 推奨優先順位: hide > bad > save > like > click。like/saveは併存可能な設計だが、
// 学習シグナルとしては「最も強い意思表示」を代表値として扱う。
const REACTION_PRIORITY: Record<string, number> = {
  hide: 5,
  bad: 4,
  not_relevant: 4,
  less_from_source: 4,
  save: 3,
  like: 2,
  useful: 2,
  more_from_source: 2,
  click: 1,
};

function reactionPriority(raw: string): number {
  return REACTION_PRIORITY[raw] ?? 0;
}

// 同じキー（recommendation_card_id・feed_item_id等）でグルーピングし、各グループから
// 優先度最大の1件だけを残す。
function pickHighestPriorityPerKey<T>(rows: T[], keyOf: (row: T) => string, typeOf: (row: T) => string): T[] {
  const bestByKey = new Map<string, T>();
  for (const row of rows) {
    const key = keyOf(row);
    const existing = bestByKey.get(key);
    if (!existing || reactionPriority(typeOf(row)) > reactionPriority(typeOf(existing))) {
      bestByKey.set(key, row);
    }
  }
  return [...bestByKey.values()];
}

function normalizeReactionType(raw: string): AggregatableReactionType | null {
  switch (raw) {
    case "like":
    case "useful":
    case "more_from_source":
      return "like";
    case "bad":
    case "not_relevant":
    case "less_from_source":
      return "dislike";
    case "save":
      return "save";
    case "hide":
      return "hide";
    default:
      // click（seen相当）等は集計対象に含めない（プラス/マイナス学習をしない）。
      return null;
  }
}

export async function loadReactionSignalSummaryForUser(): Promise<ReactionSignalSummary> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const [{ data: feedReactions, error: feedReactionsError }, { data: cardReactions, error: cardReactionsError }] =
    await Promise.all([
      supabase
        .from("reactions")
        .select("reaction_type, feed_item_id, feed_items(topic_id, source_name)")
        .eq("user_id", user.id),
      supabase
        .from("recommendation_card_reactions")
        .select("reaction_type, recommendation_card_id, recommendation_cards(genre_id, information_type, source_names)")
        .eq("user_id", user.id),
    ]);

  if (feedReactionsError) throw feedReactionsError;
  if (cardReactionsError) throw cardReactionsError;

  const { data: classifications, error: classificationsError } = await supabase
    .from("topic_classifications")
    .select("topic_id, primary_genre_id")
    .eq("user_id", user.id);
  if (classificationsError) throw classificationsError;

  const genreByTopicId = new Map(
    (classifications ?? []).map((c) => [c.topic_id as string, c.primary_genre_id as string | null]),
  );

  const events: ReactionSignalEvent[] = [];

  // 同一feed_item・同一カードに複数のリアクションが併存する場合、優先度最大の1件のみを
  // 集計対象にする（hide > bad > save > like > click。レビュー指摘#8）。
  const dedupedFeedReactions = pickHighestPriorityPerKey(
    feedReactions ?? [],
    (r) => r.feed_item_id as string,
    (r) => r.reaction_type as string,
  );
  const dedupedCardReactions = pickHighestPriorityPerKey(
    cardReactions ?? [],
    (r) => r.recommendation_card_id as string,
    (r) => r.reaction_type as string,
  );

  for (const r of dedupedFeedReactions) {
    const normalized = normalizeReactionType(r.reaction_type as string);
    if (!normalized) continue;
    const feedItem = r.feed_items as unknown as { topic_id: string; source_name: string | null } | null;
    events.push({
      reactionType: normalized,
      genreId: feedItem?.topic_id ? (genreByTopicId.get(feedItem.topic_id) ?? null) : null,
      informationTypes: [],
      sourceName: feedItem?.source_name ?? null,
    });
  }

  for (const r of dedupedCardReactions) {
    const normalized = normalizeReactionType(r.reaction_type as string);
    if (!normalized) continue;
    const card = r.recommendation_cards as unknown as {
      genre_id: string | null;
      information_type: string | null;
      source_names: string[] | null;
    } | null;
    events.push({
      reactionType: normalized,
      genreId: card?.genre_id ?? null,
      informationTypes: card?.information_type ? [card.information_type] : [],
      sourceName: card?.source_names?.[0] ?? null,
      cardType: card?.information_type ?? null,
    });
  }

  return aggregateReactionSignals(events);
}
