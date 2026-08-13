import { listDebugFeedItems } from "@/lib/debug-api/queries";
import { debugSuccess, parseLimit, withDebugAuth } from "@/lib/debug-api/response";

// 読み取り専用のdebug API。フィード記事一覧を返す（hideされた記事は除く）。
export const GET = withDebugAuth(async (request, { supabase, apiKeyHash }) => {
  const { searchParams } = new URL(request.url);
  const limit = parseLimit(searchParams);

  const items = await listDebugFeedItems(supabase, limit, apiKeyHash);

  return debugSuccess("feed_items", items, limit);
});
