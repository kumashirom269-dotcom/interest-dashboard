import { listDebugResearchPlans } from "@/lib/debug-api/queries";
import { debugSuccess, parseLimit, withDebugAuth } from "@/lib/debug-api/response";

// 読み取り専用のdebug API。AIが立てたリサーチ方針（ResearchPlan）の一覧を返す。
// raw_plan（AIの生応答に近い内容）は含めない。個別カラムで十分に確認できるため。
export const GET = withDebugAuth(async (request, { supabase, apiKeyHash }) => {
  const { searchParams } = new URL(request.url);
  const limit = parseLimit(searchParams);

  const items = await listDebugResearchPlans(supabase, limit, apiKeyHash);

  return debugSuccess("research_plans", items, limit);
});
