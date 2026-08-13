import { listDebugSources } from "@/lib/debug-api/queries";
import { debugSuccess, parseLimit, withDebugAuth } from "@/lib/debug-api/response";

// 読み取り専用のdebug API。収集元（sources）一覧を返す。
export const GET = withDebugAuth(async (request, { supabase, apiKeyHash }) => {
  const { searchParams } = new URL(request.url);
  const limit = parseLimit(searchParams);

  const sources = await listDebugSources(supabase, limit, apiKeyHash);

  return debugSuccess("sources", sources, limit);
});
