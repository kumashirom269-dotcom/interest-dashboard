// リアクション学習の集計（仕様書7-2 ReactionLearningSignal相当）。
// 既存の`reactions`（feed_item単位）・`recommendation_card_reactions`（カード単位）の
// 2系統を新規テーブルへ書き直すのではなく、呼び出し元が両テーブルを取得・ジャンル紐付け
// した上でこの純粋関数に渡す「集計ビュー」として実装する（仕様書7-2で明示的に許可されている
// 方式）。DB書き込みは行わない。
export type AggregatableReactionType = "like" | "dislike" | "save" | "hide";

export interface ReactionSignalEvent {
  reactionType: AggregatableReactionType;
  genreId: string | null;
  informationTypes: string[];
  sourceName: string | null;
  cardType?: string | null;
}

export interface SignalCounts {
  like: number;
  dislike: number;
  save: number;
  hide: number;
}

export interface ReactionSignalSummary {
  genreSignals: Record<string, SignalCounts>;
  informationTypeSignals: Record<string, SignalCounts>;
  sourceSignals: Record<string, SignalCounts>;
  cardTypeSignals: Record<string, SignalCounts>;
  totalEvents: number;
}

function emptyCounts(): SignalCounts {
  return { like: 0, dislike: 0, save: 0, hide: 0 };
}

function bump(map: Record<string, SignalCounts>, key: string, reactionType: AggregatableReactionType): void {
  const counts = map[key] ?? emptyCounts();
  counts[reactionType] += 1;
  map[key] = counts;
}

export function aggregateReactionSignals(events: ReactionSignalEvent[]): ReactionSignalSummary {
  const genreSignals: Record<string, SignalCounts> = {};
  const informationTypeSignals: Record<string, SignalCounts> = {};
  const sourceSignals: Record<string, SignalCounts> = {};
  const cardTypeSignals: Record<string, SignalCounts> = {};

  for (const event of events) {
    if (event.genreId) bump(genreSignals, event.genreId, event.reactionType);
    for (const infoType of event.informationTypes) {
      bump(informationTypeSignals, infoType, event.reactionType);
    }
    if (event.sourceName) bump(sourceSignals, event.sourceName, event.reactionType);
    if (event.cardType) bump(cardTypeSignals, event.cardType, event.reactionType);
  }

  return {
    genreSignals,
    informationTypeSignals,
    sourceSignals,
    cardTypeSignals,
    totalEvents: events.length,
  };
}

function signalScore(counts: SignalCounts | undefined): number {
  if (!counts) return 0;
  return counts.like + counts.save * 0.8 - counts.dislike - counts.hide * 0.6;
}

// 集計結果（ReactionSignalSummary）から、特定のジャンル・情報タイプ・収集元に対する
// ユーザー嗜好を0〜100（50が中立）のスコアへ変換する。
// scoreInformationValue()のbaseUserPreferenceWeight、generateResearchPlan()の
// プロンプト補足に使う。
export function computePreferenceWeightFromSignals(
  summary: ReactionSignalSummary,
  target: { genreId?: string | null; informationTypes?: string[]; sourceNames?: string[] },
): number {
  let score = 0;
  if (target.genreId) score += signalScore(summary.genreSignals[target.genreId]);
  for (const infoType of target.informationTypes ?? []) {
    score += signalScore(summary.informationTypeSignals[infoType]);
  }
  for (const sourceName of target.sourceNames ?? []) {
    score += signalScore(summary.sourceSignals[sourceName]);
  }
  // 1件あたりの重みが大きくなりすぎないよう、5倍した上で中立値50を基準にクランプする。
  return Math.min(100, Math.max(0, 50 + score * 5));
}
