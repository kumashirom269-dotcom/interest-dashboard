import { listDebugTopicClassifications } from "@/lib/debug-api/queries";
import { debugSuccess, parseLimit, withDebugAuth } from "@/lib/debug-api/response";

// 読み取り専用のdebug API。トピックのAI分類結果一覧を返す。
// raw_result（AIの生応答）は含めない。
export const GET = withDebugAuth(async (request, { supabase, apiKeyHash }) => {
  const { searchParams } = new URL(request.url);
  const limit = parseLimit(searchParams);

  const classifications = await listDebugTopicClassifications(
    supabase,
    limit,
    apiKeyHash,
  );

  return debugSuccess("topic_classifications", classifications, limit);
});
