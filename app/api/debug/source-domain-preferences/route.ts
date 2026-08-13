import { listDebugSourceDomainPreferences } from "@/lib/debug-api/queries";
import { debugSuccess, parseLimit, withDebugAuth } from "@/lib/debug-api/response";

// 読み取り専用のdebug API。research_results由来カードのリアクションから集計した、
// ユーザー・トピック・ソースドメイン単位の嗜好スコア（source_domain_preferences）を返す。
export const GET = withDebugAuth(async (request, { supabase, apiKeyHash }) => {
  const { searchParams } = new URL(request.url);
  const limit = parseLimit(searchParams);

  const items = await listDebugSourceDomainPreferences(supabase, limit, apiKeyHash);

  return debugSuccess("source_domain_preferences", items, limit);
});
