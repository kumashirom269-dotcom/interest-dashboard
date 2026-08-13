import { listDebugResearchResults } from "@/lib/debug-api/queries";
import { debugSuccess, parseLimit, withDebugAuth } from "@/lib/debug-api/response";

// 読み取り専用のdebug API。検索拡張型リサーチ収集（research_results）の一覧を返す。
// providerが"mock"のものも含めて返す（開発中に「実データかモックか」を見分けられるように、
// あえてフィルタしていない）。
export const GET = withDebugAuth(async (request, { supabase, apiKeyHash }) => {
  const { searchParams } = new URL(request.url);
  const limit = parseLimit(searchParams);

  const items = await listDebugResearchResults(supabase, limit, apiKeyHash);

  return debugSuccess("research_results", items, limit);
});
