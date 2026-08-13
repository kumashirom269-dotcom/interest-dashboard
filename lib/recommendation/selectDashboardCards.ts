// マイページに表示するカードの多様性込み選定（仕様書7-4・レビュー指摘の8段階順に準拠）。
// 初期表示は原則12件。高品質な候補が無ければ無理に埋めない（低スコアカードでの水増し禁止）。
import type { RecommendationCard } from "@/lib/recommendation-cards/types";

export interface SelectDashboardCardsOptions {
  // 初期表示件数の上限。原則12件（トピック絞り込み時も候補数に応じて最大12件）。
  targetCount: number;
  maxPerTopic: number;
  maxPerInformationType: number;
  maxPerSource: number;
  // これ未満のinformationValueScoreを持つ通常カード（critical/high以外）は
  // 件数を埋めるためだけに追加しない。スコア未計算（null）のカードは中立扱いで通す。
  minQualityScore: number;
  // トピック最低1件確保（下記ステップ2）だけに使う、より緩い下限。実データ検証で、
  // 「嵐」のような一般的で安全なトピックでも、その時点で見つかった最善のカードが
  // 51〜53点にとどまり、minQualityScore(55)未満のため丸ごと0件表示になる事例が見つかった。
  // 「品質基準未満のカードは一切見せない」（minQualityScore導入のきっかけになった、
  // 具体性の無いスコア43のグルメまとめカードの事例）と、「登録したトピックに
  // 何も表示されないのは避けたい」という2つの要求を両立させるため、通常の複数カード
  // 表示にはminQualityScoreを使い、トピック最低1件の保証だけはこの緩い下限を使う
  // （43点は依然として除外、51〜53点は最低枠でなら表示、という切り分けになる）。
  minQualityScoreForTopicMinimum: number;
  hiddenCardIds?: Set<string>;
  // click（既読/seen相当）済みカードのID集合。未読カードを優先するために使う。
  readCardIds?: Set<string>;
}

const DEFAULT_OPTIONS: SelectDashboardCardsOptions = {
  targetCount: 12,
  maxPerTopic: 3,
  maxPerInformationType: 4,
  maxPerSource: 4,
  // 通常カード（critical/high以外）の表示最低品質基準（レビュー指摘#6）。実機検証で
  // スコア43の一般的なグルメまとめカードがマイページに表示されてしまう事例が見つかったため、
  // 35から55へ引き上げた。critical/highはこの基準によらず別途確保される（isHighPriority）。
  minQualityScore: 55,
  // トピック最低1件確保専用の下限（上記コメント参照）。
  minQualityScoreForTopicMinimum: 45,
};

function primarySourceName(card: RecommendationCard): string {
  return card.sourceNames[0] ?? "unknown";
}

function isHighPriority(card: RecommendationCard): boolean {
  return card.riskLevel === "critical" || card.riskLevel === "high";
}

function cardScore(card: RecommendationCard): number {
  return card.informationValueScore ?? 50;
}

// 仕様書7-4・レビュー指摘の8段階選定順（2回目レビューで2→3を明確化）:
// 1. 現在有効なcritical・high情報を確保
// 2. 品質基準を満たす各トピックの最上位1件を確保（情報タイプ・ソース上限を無視してでも
//    トピックが0件にならないようにする。ただし品質基準未満のカードでは埋めない）
// 3. 未読の高スコアカードを優先
// 4. 情報タイプの多様性
// 5. 収集元・ドメインの多様性
// 6. 同一エンティティ・同一ソースの連続表示抑制
// 7. 地域・動画・イベント・保存価値等のバランス（情報タイプの多様性確保に内包）
// 8. 最大12件へ調整
export function selectDashboardCards(
  cards: RecommendationCard[],
  options: Partial<SelectDashboardCardsOptions> = {},
): RecommendationCard[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // 同一dedupeKey（同一クラスタ・同一出来事）は、最もスコアの高い1件のみ残す
  // （仕様書「同一イベントの複数カード表示をしない」対応）。
  const bestByDedupeKey = new Map<string, RecommendationCard>();
  const withoutDedupeKey: RecommendationCard[] = [];
  for (const card of cards) {
    if (opts.hiddenCardIds?.has(card.id)) continue;
    if (!card.dedupeKey) {
      withoutDedupeKey.push(card);
      continue;
    }
    const existing = bestByDedupeKey.get(card.dedupeKey);
    if (!existing || cardScore(card) > cardScore(existing)) {
      bestByDedupeKey.set(card.dedupeKey, card);
    }
  }
  const deduped = [...bestByDedupeKey.values(), ...withoutDedupeKey];

  // 低品質カードでの水増しを避けるため、critical/high以外はminQualityScore未満を
  // 選定対象から完全に除外する（優先度を下げるだけでなく、そもそも候補にしない）。
  // トピック最低枠の確保も、この時点で除外された（品質基準未満・期限切れ相当の）
  // カードにまでは適用しない。
  const eligible = deduped.filter((c) => isHighPriority(c) || cardScore(c) >= opts.minQualityScore);

  const sorted = [...eligible].sort((a, b) => {
    // 1. critical/highを最優先
    const aPriority = isHighPriority(a) ? 1 : 0;
    const bPriority = isHighPriority(b) ? 1 : 0;
    if (aPriority !== bPriority) return bPriority - aPriority;
    // 2. 未読（未クリック）を優先
    const aUnread = opts.readCardIds?.has(a.id) ? 0 : 1;
    const bUnread = opts.readCardIds?.has(b.id) ? 0 : 1;
    if (aUnread !== bUnread) return bUnread - aUnread;
    // スコア降順、同点は新しい順
    const scoreDiff = cardScore(b) - cardScore(a);
    if (scoreDiff !== 0) return scoreDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const selected: RecommendationCard[] = [];
  const perTopicCount = new Map<string, number>();
  const perInformationTypeCount = new Map<string, number>();
  const perSourceCount = new Map<string, number>();

  function canAdd(card: RecommendationCard, bypassCaps: boolean): boolean {
    if (bypassCaps) return true;
    const topicCount = perTopicCount.get(card.topicId) ?? 0;
    const infoTypeCount = perInformationTypeCount.get(card.informationType) ?? 0;
    const sourceCount = perSourceCount.get(primarySourceName(card)) ?? 0;
    return (
      topicCount < opts.maxPerTopic &&
      infoTypeCount < opts.maxPerInformationType &&
      sourceCount < opts.maxPerSource
    );
  }

  function add(card: RecommendationCard): void {
    selected.push(card);
    perTopicCount.set(card.topicId, (perTopicCount.get(card.topicId) ?? 0) + 1);
    perInformationTypeCount.set(card.informationType, (perInformationTypeCount.get(card.informationType) ?? 0) + 1);
    perSourceCount.set(primarySourceName(card), (perSourceCount.get(primarySourceName(card)) ?? 0) + 1);
  }

  // 1. critical/highは上限を緩和して確保する。
  for (const card of sorted) {
    if (selected.some((s) => s.id === card.id)) continue;
    if (isHighPriority(card)) add(card);
  }

  // 2. 各トピックの最上位1件を、情報タイプ・ソース上限を無視してでも確保する
  // （情報タイプの多様性上限だけが原因で、特定のトピックが0件になることを防ぐ）。
  // トピックごとの最高スコア順に処理することで、トピック数がtargetCountを超える
  // ような極端なケースでも、スコアの高いトピックの最低枠が優先的に生き残るようにする。
  // ここだけはminQualityScoreではなくminQualityScoreForTopicMinimum（緩い下限）を使う
  // （実データ検証: 「嵐」のような一般的なトピックで最善のカードが51〜53点にとどまり、
  // minQualityScore=55だと登録トピックが丸ごと0件表示になっていた事例への対応）。
  const minimumGuaranteeEligible = deduped.filter(
    (c) => isHighPriority(c) || cardScore(c) >= opts.minQualityScoreForTopicMinimum,
  );
  const bestPerTopic = new Map<string, RecommendationCard>();
  for (const card of minimumGuaranteeEligible) {
    const existing = bestPerTopic.get(card.topicId);
    if (!existing || cardScore(card) > cardScore(existing)) {
      bestPerTopic.set(card.topicId, card);
    }
  }
  const topicMinimumOrder = [...bestPerTopic.values()].sort((a, b) => cardScore(b) - cardScore(a));
  for (const card of topicMinimumOrder) {
    if (selected.length >= opts.targetCount) break;
    if (selected.some((s) => s.topicId === card.topicId)) continue;
    add(card);
  }

  // 3〜5. 情報タイプ・収集元の偏りを抑えながら、スコア順（未読優先）に残りを埋める。
  // 目標件数に満たなくても、低品質・偏ったカードで無理に埋めない
  // （上限を無視した水増しは行わない）。
  for (const card of sorted) {
    if (selected.length >= opts.targetCount) break;
    if (selected.some((s) => s.id === card.id)) continue;
    if (canAdd(card, false)) add(card);
  }

  // 6. 同一エンティティ・同一ソースの連続表示を抑制する（隣接する2件の入れ替え）。
  for (let i = 1; i < selected.length; i++) {
    const prev = selected[i - 1];
    const curr = selected[i];
    const sameEntity = prev.entityName && curr.entityName && prev.entityName === curr.entityName;
    const sameSource = primarySourceName(prev) === primarySourceName(curr);
    if (!sameEntity && !sameSource) continue;

    const swapIndex = selected.findIndex((c, idx) => {
      if (idx <= i) return false;
      const conflictsWithPrev =
        (c.entityName && c.entityName === prev.entityName) || primarySourceName(c) === primarySourceName(prev);
      return !conflictsWithPrev;
    });
    if (swapIndex > i) {
      [selected[i], selected[swapIndex]] = [selected[swapIndex], selected[i]];
    }
  }

  // 8. 最大targetCount件へ調整（無理に埋めない。候補が少なければそのまま返す）。
  return selected.slice(0, opts.targetCount);
}
