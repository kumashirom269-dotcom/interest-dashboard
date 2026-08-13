// hide/seenによる「同一クラスタ（同じ出来事・話題）」の再表示抑制で使う実行間dedupeキー。
// research_vetting_results.cluster_key（同一パイプライン実行内でのみ有効）とは異なり、
// 「トピックID＋正規化タイトルトークン」を鍵にすることで、再収集のたびにクラスタが
// 作り直されても、同じ話題であれば同じキーになりやすくする（完全な同一性保証ではない、
// 簡易的な近似）。
import { normalizeTitleTokens } from "@/lib/recommendation-cards/clustering";

export function computeDedupeKey(topicId: string, representativeTitle: string): string {
  const tokens = [...normalizeTitleTokens(representativeTitle)].sort();
  return `${topicId}::${tokens.join(",")}`;
}

// このいずれかの情報タイプを持つ場合、「重大な更新」とみなし、同一dedupeKeyで
// 過去にhide/seen（既読）されていても再表示を許可する（仕様書7-1「hide」の
// 「重大な変更があれば再表示可能」に対応）。
export const MAJOR_UPDATE_INFORMATION_TYPES: ReadonlySet<string> = new Set([
  "cancellation",
  "postponement",
  "venue_change",
  "cast_change",
  "price_increase",
  "price_decrease",
  "recall",
  "product_accident",
  "warning",
  "alert",
  "infectious_disease",
  "food_poisoning",
  "poisoning",
  "accident",
  "defect",
  "fraud",
  "security_incident",
  "data_breach",
  "disaster",
  "evacuation",
  "application_deadline",
  "application_deadline_system",
  "eligibility_change",
  "temporary_closure",
  "permanent_closure",
  "business_hours_change",
]);

export function isMajorUpdateInformationType(informationTypes: string[]): boolean {
  return informationTypes.some((t) => MAJOR_UPDATE_INFORMATION_TYPES.has(t));
}
