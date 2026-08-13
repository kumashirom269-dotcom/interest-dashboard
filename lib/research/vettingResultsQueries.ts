import { createClient } from "@/lib/supabase/server";
import type { VettingExcludeReason, VettingJudgement } from "@/lib/ai/vetResearchCandidates";

export interface NewVettingResultRecord {
  topicId: string;
  researchPlanId: string | null;
  clusterKey: string;
  judgement: VettingJudgement;
  excludeReason: VettingExcludeReason | null;
  reason: string;
  matchedPositiveSignals: string[];
  matchedNegativeSignals: string[];
  representativeTitle: string;
  representativeUrl: string | null;
  candidateCount: number;
}

export interface PersistedVettingResult extends NewVettingResultRecord {
  id: string;
  createdAt: string;
}

interface VettingResultRow {
  id: string;
  topic_id: string;
  research_plan_id: string | null;
  cluster_key: string;
  judgement: string;
  exclude_reason: string | null;
  reason: string | null;
  matched_positive_signals: unknown;
  matched_negative_signals: unknown;
  representative_title: string | null;
  representative_url: string | null;
  candidate_count: number;
  created_at: string;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function mapRow(row: VettingResultRow): PersistedVettingResult {
  return {
    id: row.id,
    topicId: row.topic_id,
    researchPlanId: row.research_plan_id,
    clusterKey: row.cluster_key,
    judgement: row.judgement as VettingJudgement,
    excludeReason: row.exclude_reason as VettingExcludeReason | null,
    reason: row.reason ?? "",
    matchedPositiveSignals: asStringArray(row.matched_positive_signals),
    matchedNegativeSignals: asStringArray(row.matched_negative_signals),
    representativeTitle: row.representative_title ?? "",
    representativeUrl: row.representative_url,
    candidateCount: row.candidate_count,
    createdAt: row.created_at,
  };
}

// vetResearchCandidatesの判定結果（use/hold/exclude）をdebugできるように永続化する。
// クラスタ単位の判定であり単一のresearch_results行とは1:1対応しないため、
// 専用テーブル（research_vetting_results）へ一括insertする。
export async function insertResearchVettingResults(
  records: NewVettingResultRecord[],
): Promise<PersistedVettingResult[]> {
  if (records.length === 0) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("research_vetting_results")
    .insert(
      records.map((r) => ({
        user_id: user.id,
        topic_id: r.topicId,
        research_plan_id: r.researchPlanId,
        cluster_key: r.clusterKey,
        judgement: r.judgement,
        exclude_reason: r.excludeReason,
        reason: r.reason,
        matched_positive_signals: r.matchedPositiveSignals,
        matched_negative_signals: r.matchedNegativeSignals,
        representative_title: r.representativeTitle,
        representative_url: r.representativeUrl,
        candidate_count: r.candidateCount,
      })),
    )
    .select(
      "id, topic_id, research_plan_id, cluster_key, judgement, exclude_reason, reason, matched_positive_signals, matched_negative_signals, representative_title, representative_url, candidate_count, created_at",
    );

  if (error) throw error;

  return (data ?? []).map((row) => mapRow(row as unknown as VettingResultRow));
}
