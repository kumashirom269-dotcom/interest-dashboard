import { listDebugSavedItems } from "@/lib/debug-api/queries";
import { debugSuccess, parseLimit, withDebugAuth } from "@/lib/debug-api/response";

// 読み取り専用のdebug API。保存済み（saved）記事一覧を返す。
export const GET = withDebugAuth(async (request, { supabase, apiKeyHash }) => {
  const { searchParams } = new URL(request.url);
  const limit = parseLimit(searchParams);

  const items = await listDebugSavedItems(supabase, limit, apiKeyHash);

  return debugSuccess("saved_items", items, limit);
});
