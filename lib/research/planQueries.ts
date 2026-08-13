import { createClient } from "@/lib/supabase/server";
import type {
  InformationNeed,
} from "@/lib/topic-classification/types";
import type {
  PersistedResearchPlan,
  ResearchCandidateBudget,
  ResearchChannel,
  ResearchExpansionPolicy,
  ResearchFreshnessPolicy,
  ResearchPlan,
  ResearchSourcePriority,
  ResearchSourceRequirements,
} from "./types";

interface ResearchPlanRow {
  id: string;
  topic_id: string;
  topic_name: string;
  primary_goal: string | null;
  preferred_channels: unknown;
  search_queries: unknown;
  official_site_queries: unknown;
  event_queries: unknown;
  exclusion_queries: unknown;
  must_include_signals: unknown;
  must_exclude_signals: unknown;
  source_priority: unknown;
  freshness_policy: unknown;
  expected_result_types: unknown;
  notes_for_vetting: string | null;
  raw_plan: unknown;
  created_at: string;
  primary_genre_id: string | null;
}

const SELECT_COLUMNS =
  "id, topic_id, topic_name, primary_goal, preferred_channels, search_queries, official_site_queries, event_queries, exclusion_queries, must_include_signals, must_exclude_signals, source_priority, freshness_policy, expected_result_types, notes_for_vetting, raw_plan, created_at, primary_genre_id";

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

const DEFAULT_SOURCE_PRIORITY: ResearchSourcePriority = {
  official: 0,
  news: 0,
  local: 0,
  social: 0,
  blog: 0,
  search: 0,
  rss: 0,
};

const DEFAULT_FRESHNESS_POLICY: ResearchFreshnessPolicy = {
  allowHistorical: false,
  preferFuture: false,
  maxAgeDays: null,
  explanation: "",
};

const DEFAULT_EXPANSION_POLICY: ResearchExpansionPolicy = {
  enabled: false,
  trigger: "none",
  expandedInformationNeeds: [],
  expansionQueries: [],
  explanation: "",
};

const DEFAULT_SOURCE_REQUIREMENTS: ResearchSourceRequirements = {
  requiredTier1Categories: [],
  preferredTier2Categories: [],
  optionalTier3Categories: [],
  blockedSourceCategories: [],
  prohibitedTier3Uses: [],
  officialVerificationRequired: false,
  minimumIndependentSources: 1,
};

const DEFAULT_CANDIDATE_BUDGET: ResearchCandidateBudget = {
  maxCollectedCandidates: 0,
  maxCandidatesPerSource: 0,
  maxCandidatesPerInformationType: 0,
  targetCardCount: 0,
};

// raw_planはResearchPlan生成時点のスナップショット（JSON化されて保存されている）。
// 個別カラムはdebug APIでの絞り込み・表示を楽にするためのものであり、
// 読み取り時は個別カラムを正としつつ、欠けている場合のみraw_planから補完する
// （将来ResearchPlanにフィールドが増えても、raw_planには常に全体が残るようにするため）。
// expansionPolicyは専用カラムを持たず、raw_planからのみ復元する
// （初期収集後にactions.ts側で確定するため、insertResearchPlan呼び出し時点の
// raw_planには既定値（無効）しか入っていないことが多い点に注意）。
function mapRow(row: ResearchPlanRow): PersistedResearchPlan {
  const raw = (row.raw_plan ?? {}) as Partial<ResearchPlan>;

  return {
    id: row.id,
    topicId: row.topic_id,
    topicName: row.topic_name,
    userIntentSummary: raw.userIntentSummary ?? "",
    primaryGoal: row.primary_goal ?? raw.primaryGoal ?? "",
    preferredChannels: asStringArray(row.preferred_channels) as ResearchChannel[],
    searchQueries: asStringArray(row.search_queries),
    officialSiteQueries: asStringArray(row.official_site_queries),
    eventQueries: asStringArray(row.event_queries),
    exclusionQueries: asStringArray(row.exclusion_queries),
    mustIncludeSignals: asStringArray(row.must_include_signals),
    mustExcludeSignals: asStringArray(row.must_exclude_signals),
    sourcePriority: (row.source_priority as ResearchSourcePriority) ?? DEFAULT_SOURCE_PRIORITY,
    freshnessPolicy: (row.freshness_policy as ResearchFreshnessPolicy) ?? DEFAULT_FRESHNESS_POLICY,
    expectedResultTypes: asStringArray(row.expected_result_types) as InformationNeed[],
    notesForVetting: row.notes_for_vetting ?? "",
    expansionPolicy: raw.expansionPolicy ?? DEFAULT_EXPANSION_POLICY,
    // 33ジャンルエンジン導入により追加。primary_genre_idのみ専用カラムを持たせ、
    // それ以外（sourceRequirements等）はraw_planから復元する（個別カラムを増やしすぎない）。
    primaryGenreId: row.primary_genre_id ?? raw.primaryGenreId ?? "unknown",
    informationTypes: raw.informationTypes ?? [],
    sourceRequirements: raw.sourceRequirements ?? DEFAULT_SOURCE_REQUIREMENTS,
    candidateBudget: raw.candidateBudget ?? DEFAULT_CANDIDATE_BUDGET,
    preferredCardTypes: raw.preferredCardTypes ?? [],
    safetyConstraints: raw.safetyConstraints ?? [],
    createdAt: row.created_at,
  };
}

// ResearchPlanをDBへ保存する。1回の自動収集実行につき1行追加する（更新はしない、追記のみ）。
// 保存に失敗しても呼び出し元（runInitialAutoCollection）がtry/catchで吸収し、
// research_plan_idをnullのまま以後の処理を続行できるようにしている。
export async function insertResearchPlan(plan: ResearchPlan): Promise<PersistedResearchPlan> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("research_plans")
    .insert({
      user_id: user.id,
      topic_id: plan.topicId,
      topic_name: plan.topicName,
      primary_goal: plan.primaryGoal,
      preferred_channels: plan.preferredChannels,
      search_queries: plan.searchQueries,
      official_site_queries: plan.officialSiteQueries,
      event_queries: plan.eventQueries,
      exclusion_queries: plan.exclusionQueries,
      must_include_signals: plan.mustIncludeSignals,
      must_exclude_signals: plan.mustExcludeSignals,
      source_priority: plan.sourcePriority,
      freshness_policy: plan.freshnessPolicy,
      expected_result_types: plan.expectedResultTypes,
      notes_for_vetting: plan.notesForVetting,
      raw_plan: plan,
      primary_genre_id: plan.primaryGenreId,
    })
    .select(SELECT_COLUMNS)
    .single();

  if (error) throw error;

  return mapRow(data as unknown as ResearchPlanRow);
}
