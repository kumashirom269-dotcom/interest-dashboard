import { AI_LIMITS } from "@/lib/config/aiLimits";
import type { ResearchCoverageEvaluation } from "./evaluateResearchCoverage";
import type { ResearchChannel, ResearchPlan, ResearchQuery } from "./types";

export interface PlannedFollowUpQuery {
  query: ResearchQuery;
  channel: ResearchChannel;
  followUpReason: string;
}

// クエリ文字列の見た目から、公式・イベント・動画系の意図を推測してchannelを割り当てる。
// evaluateResearchCoverageのsuggestedChannelsを補助的な既定値として使う。
function inferChannel(query: string, suggestedChannels: ResearchChannel[]): ResearchChannel {
  if (query.includes("公式")) return "official_site";
  if (query.includes("チケット") || query.includes("イベント")) return "event_site";
  if (query.includes("YouTube") || query.includes("動画")) return "social_or_video";
  return suggestedChannels[0] ?? "brave_search";
}

// evaluateResearchCoverageが不足と判断した場合の補助検索クエリを組み立てる純関数。
// 新たなAI呼び出しは行わず、ResearchCoverageEvaluation.suggestedFollowUpQueries
// （ルールベースで生成済み）をそのまま検索クエリ化するだけに留める（コスト最小化）。
// 既にResearchPlanの初期クエリに含まれているものは重複実行しないよう除外する。
export function buildFollowUpQueries(
  evaluation: ResearchCoverageEvaluation,
  plan: ResearchPlan,
): PlannedFollowUpQuery[] {
  const alreadyUsed = new Set([
    ...plan.searchQueries,
    ...plan.officialSiteQueries,
    ...plan.eventQueries,
  ]);
  const seen = new Set<string>();
  const followUpReason = `不足判断による追加検索（${evaluation.missingAspects.join(", ")}）`;
  const result: PlannedFollowUpQuery[] = [];

  for (const q of evaluation.suggestedFollowUpQueries) {
    if (!q || alreadyUsed.has(q) || seen.has(q)) continue;
    seen.add(q);

    result.push({
      query: {
        query: q,
        purpose: followUpReason,
        priority: 60,
        expectedResultType: "web_article",
      },
      channel: inferChannel(q, evaluation.suggestedChannels),
      followUpReason,
    });

    if (result.length >= AI_LIMITS.maxFollowUpQueries) break;
  }

  return result;
}
