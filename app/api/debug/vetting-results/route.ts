import { listDebugResearchVettingResults } from "@/lib/debug-api/queries";
import { debugSuccess, parseLimit, withDebugAuth } from "@/lib/debug-api/response";

// 読み取り専用のdebug API。vetResearchCandidates（AIによるuse/hold/exclude判定）の
// 結果一覧を返す。なぜ採用/除外されたのか（judgement・excludeReason・reason・
// matched_positive_signals・matched_negative_signals）を後から確認できる。
export const GET = withDebugAuth(async (request, { supabase, apiKeyHash }) => {
  const { searchParams } = new URL(request.url);
  const limit = parseLimit(searchParams);

  const items = await listDebugResearchVettingResults(supabase, limit, apiKeyHash);

  return debugSuccess("research_vetting_results", items, limit);
});
