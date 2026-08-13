// 情報価値スコア（仕様書6-7 InformationValueScore）。AIには頼らず、収集済みの
// メタデータ（チャネル・鮮度・公式性・クラスタ件数等）から決定的に計算する純粋関数。
// research_results.popularity_score等のスコア列は現状常にnull（Web検索APIが未実装のため）
// なので、ここではクラスタ精査結果（VettingResult）とジャンル設定から代替的に算出する。
import type { GenreDetailedConfig, GenreScoringWeights } from "@/lib/genres/types";
import type { FreshnessProfile } from "@/lib/topic-classification/types";
import type { ResearchChannel } from "@/lib/research/types";
import type { VettingJudgement } from "@/lib/ai/vetResearchCandidates";
import { computeEffectiveUserPreferenceWeight } from "@/lib/reactions/safetyAdjustedPreference";

export interface InformationValueScore {
  relevance: number;
  freshness: number;
  reliability: number;
  novelty: number;
  actionability: number;
  urgency: number;
  regionalFit: number;
  userPreference: number;
  sourceDiversity: number;
  visualQuality: number;
  evergreenValue: number;

  commercialBiasPenalty: number;
  duplicationPenalty: number;
  uncertaintyPenalty: number;
  stalePenalty: number;
  safetyPenalty: number;

  totalScore: number;
}

export interface ScoreInformationValueInput {
  judgement: VettingJudgement;
  itemCount: number;
  sourceNames: string[];
  publishedAt: string | null;
  todayDate: string;
  channel: ResearchChannel | null;
  isOfficialSource: boolean;
  hasImage: boolean;
  isFollowUp: boolean;
  freshnessProfile: FreshnessProfile;
  locationRequired: boolean;
  genreConfig: GenreDetailedConfig | undefined;
  // リアクション学習（lib/reactions/aggregateReactionSignals.ts）から算出した、
  // このジャンル・情報タイプ・収集元に対するユーザーの過去の嗜好（0〜100、50が中立）。
  // 未指定の場合は中立値50を使う（リアクション履歴が無い新規ユーザー等）。
  baseUserPreferenceWeight?: number;
}

const CHANNEL_RELIABILITY: Record<ResearchChannel, number> = {
  official_site: 95,
  documentation: 85,
  news_site: 80,
  event_site: 75,
  ticket_site: 75,
  local_media: 70,
  rss: 65,
  brave_search: 55,
  general_web: 50,
  social_or_video: 40,
};

function clamp(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function computeAgeDays(publishedAt: string | null, todayDate: string): number | null {
  if (!publishedAt) return null;
  const publishedMs = Date.parse(publishedAt);
  const todayMs = Date.parse(todayDate);
  if (Number.isNaN(publishedMs) || Number.isNaN(todayMs)) return null;
  return Math.max(0, Math.floor((todayMs - publishedMs) / (1000 * 60 * 60 * 24)));
}

function computeFreshness(ageDays: number | null, freshnessProfile: FreshnessProfile): number {
  if (freshnessProfile === "evergreen") return 70;
  if (ageDays == null) return 50;
  const decayPerDay =
    freshnessProfile === "breaking" ? 15 : freshnessProfile === "high_frequency" ? 6 : freshnessProfile === "daily" ? 2 : 1;
  return clamp(100 - ageDays * decayPerDay);
}

export function scoreInformationValue(input: ScoreInformationValueInput): InformationValueScore {
  const ageDays = computeAgeDays(input.publishedAt, input.todayDate);
  const freshness = computeFreshness(ageDays, input.freshnessProfile);

  const relevance = input.judgement === "use" ? 90 : input.judgement === "hold" ? 55 : 15;

  let reliability = input.channel ? CHANNEL_RELIABILITY[input.channel] : 50;
  if (input.isOfficialSource) reliability = clamp(reliability + 10);

  const novelty = input.isFollowUp ? 40 : 70;

  const actionableChannels: ResearchChannel[] = ["ticket_site", "event_site", "official_site"];
  const actionability = input.channel && actionableChannels.includes(input.channel) ? 75 : 45;

  const genreRisk = input.genreConfig?.defaultRiskLevel ?? "normal";
  const urgency =
    genreRisk === "critical"
      ? 90
      : genreRisk === "high"
        ? 70
        : input.freshnessProfile === "breaking"
          ? 90
          : input.freshnessProfile === "high_frequency"
            ? 60
            : 30;

  const regionalFit = input.locationRequired ? 70 : 50;
  // 高リスク・criticalジャンルでは、ユーザー嗜好が信頼性・安全性を上回らないよう
  // computeEffectiveUserPreferenceWeight（仕様書7-3）でリスク調整する。
  const userPreference = clamp(
    computeEffectiveUserPreferenceWeight(input.baseUserPreferenceWeight ?? 50, genreRisk),
  );
  const uniqueSources = new Set(input.sourceNames).size;
  const sourceDiversity = clamp((uniqueSources / Math.max(1, input.itemCount)) * 100);
  const visualQuality = input.hasImage ? 70 : 30;
  const evergreenValue = input.freshnessProfile === "evergreen" ? 80 : 20;

  const commercialBiasPenalty = input.channel === "social_or_video" ? 5 : 0;
  const duplicationPenalty = 0;
  const uncertaintyPenalty = input.judgement === "hold" ? 15 : 0;
  const stalePenalty = clamp(100 - freshness) > 60 ? 10 : 0;
  const safetyPenalty =
    (genreRisk === "critical" || genreRisk === "high") && !input.isOfficialSource ? 15 : 0;

  const weights: GenreScoringWeights = input.genreConfig?.scoringWeights ?? {
    relevance: 0.21,
    freshness: 0.15,
    reliability: 0.16,
    novelty: 0.09,
    actionability: 0.1,
    urgency: 0.08,
    regionalFit: 0.06,
    userPreference: 0.06,
    sourceDiversity: 0.03,
    visualQuality: 0.03,
    evergreenValue: 0.03,
  };

  const totalScore = clamp(
    relevance * weights.relevance +
      freshness * weights.freshness +
      reliability * weights.reliability +
      novelty * weights.novelty +
      actionability * weights.actionability +
      urgency * weights.urgency +
      regionalFit * weights.regionalFit +
      userPreference * weights.userPreference +
      sourceDiversity * weights.sourceDiversity +
      visualQuality * weights.visualQuality +
      evergreenValue * weights.evergreenValue -
      commercialBiasPenalty -
      duplicationPenalty -
      uncertaintyPenalty -
      stalePenalty -
      safetyPenalty,
  );

  return {
    relevance,
    freshness,
    reliability,
    novelty,
    actionability,
    urgency,
    regionalFit,
    userPreference,
    sourceDiversity,
    visualQuality,
    evergreenValue,
    commercialBiasPenalty,
    duplicationPenalty,
    uncertaintyPenalty,
    stalePenalty,
    safetyPenalty,
    totalScore,
  };
}
