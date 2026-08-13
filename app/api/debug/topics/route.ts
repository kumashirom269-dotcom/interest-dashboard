import { listDebugTopics } from "@/lib/debug-api/queries";
import { debugSuccess, parseLimit, withDebugAuth } from "@/lib/debug-api/response";

// 読み取り専用のdebug API。トピック一覧を返す。
export const GET = withDebugAuth(async (request, { supabase, apiKeyHash }) => {
  const { searchParams } = new URL(request.url);
  const limit = parseLimit(searchParams);

  const topics = await listDebugTopics(supabase, limit, apiKeyHash);

  return debugSuccess("topics", topics, limit);
});
