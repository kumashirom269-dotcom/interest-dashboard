import type { SupabaseClient } from "@supabase/supabase-js";

export type DomainReactionType = "like" | "bad" | "save" | "hide" | "click";

// like/save/bad/hide/clickの強度差（レビュー指摘#4）。
// save > like（保存はいいねより強い肯定シグナル）、hide > bad（非表示は明確な否定シグナル）、
// clickは弱い肯定（閲覧しただけ）でnegativeにはしない。
const POSITIVE_DELTA: Partial<Record<DomainReactionType, number>> = {
  like: 5,
  save: 8,
  click: 1,
};
const NEGATIVE_DELTA: Partial<Record<DomainReactionType, number>> = {
  bad: 5,
  hide: 8,
};
const COUNT_FIELD: Record<DomainReactionType, string> = {
  like: "like_count",
  bad: "bad_count",
  hide: "hide_count",
  save: "save_count",
  click: "click_count",
};

interface DomainPreferenceRow {
  id: string;
  positive_score: number;
  negative_score: number;
  like_count: number;
  bad_count: number;
  hide_count: number;
  save_count: number;
  click_count: number;
}

// sourcesテーブルに完全一致するドメインが無い場合でも、ユーザー・トピック・ドメイン単位で
// リアクションを集計できるようにする（レビュー指摘#4。research_results由来カードの主要な
// 収集経路で個別ソース学習が働かなかった問題への対応）。sourcesが完全一致する場合の
// 従来のsource_score更新（lib/recommendation-card-reactions/queries.ts）とは独立に、
// 常にこちらも更新する。
export async function upsertSourceDomainPreference(
  supabase: SupabaseClient,
  userId: string,
  topicId: string,
  sourceDomain: string,
  sourceName: string | null,
  reactionType: DomainReactionType,
  direction: "add" | "remove",
): Promise<void> {
  const { data: existing, error: selectError } = await supabase
    .from("source_domain_preferences")
    .select("id, positive_score, negative_score, like_count, bad_count, hide_count, save_count, click_count")
    .eq("user_id", userId)
    .eq("topic_id", topicId)
    .eq("source_domain", sourceDomain)
    .maybeSingle();
  if (selectError) throw selectError;

  const sign = direction === "add" ? 1 : -1;
  const positiveDelta = POSITIVE_DELTA[reactionType] ?? 0;
  const negativeDelta = NEGATIVE_DELTA[reactionType] ?? 0;
  const countField = COUNT_FIELD[reactionType];

  if (!existing) {
    if (direction !== "add") return;
    const { error: insertError } = await supabase.from("source_domain_preferences").insert({
      user_id: userId,
      topic_id: topicId,
      source_domain: sourceDomain,
      source_name: sourceName,
      positive_score: Math.max(0, positiveDelta),
      negative_score: Math.max(0, negativeDelta),
      [countField]: 1,
      last_reaction_at: new Date().toISOString(),
    });
    if (insertError) throw insertError;
    return;
  }

  const row = existing as DomainPreferenceRow;
  const currentCount = row[countField as keyof DomainPreferenceRow] as number;

  const { error: updateError } = await supabase
    .from("source_domain_preferences")
    .update({
      positive_score: Math.max(0, row.positive_score + sign * positiveDelta),
      negative_score: Math.max(0, row.negative_score + sign * negativeDelta),
      [countField]: Math.max(0, currentCount + sign),
      source_name: sourceName ?? undefined,
      last_reaction_at: new Date().toISOString(),
    })
    .eq("id", row.id);
  if (updateError) throw updateError;
}

export interface SourceDomainPreferenceSummary {
  domain: string;
  sourceName: string | null;
  positiveScore: number;
  negativeScore: number;
}

export async function getSourceDomainPreferencesForTopic(
  supabase: SupabaseClient,
  userId: string,
  topicId: string,
): Promise<SourceDomainPreferenceSummary[]> {
  const { data, error } = await supabase
    .from("source_domain_preferences")
    .select("source_domain, source_name, positive_score, negative_score")
    .eq("user_id", userId)
    .eq("topic_id", topicId);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    domain: r.source_domain as string,
    sourceName: r.source_name as string | null,
    positiveScore: r.positive_score as number,
    negativeScore: r.negative_score as number,
  }));
}

// 0〜100スケールの嗜好スコアへ変換する（scoreInformationValueのuserPreference等で使う。
// 50が中立、positive優位で50超、negative優位で50未満）。
export function domainPreferenceWeight(pref: { positiveScore: number; negativeScore: number }): number {
  const net = pref.positiveScore - pref.negativeScore;
  return Math.min(100, Math.max(0, 50 + net * 3));
}
