import { buildDebugApiOpenApiSchema } from "@/lib/debug-api/openapiSchema";
import { withDebugAuth } from "@/lib/debug-api/response";

// debug APIのOpenAPI 3.1スキーマ。Custom GPT Actions等に取り込む際の下地として提供する。
export const GET = withDebugAuth(async (request: Request) => {
  const origin = new URL(request.url).origin;
  return Response.json(buildDebugApiOpenApiSchema(origin));
});
