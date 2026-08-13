import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  DEBUG_API_KEY_HEADER,
  DebugApiForbiddenError,
  DebugApiMisconfiguredError,
  hashApiKey,
  resolveDebugViewer,
  type DebugViewer,
} from "./auth";
import { createDebugAnonClient } from "./supabaseClient";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export function parseLimit(searchParams: URLSearchParams): number {
  const raw = searchParams.get("limit");
  if (!raw) return DEFAULT_LIMIT;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.floor(parsed));
}

export function debugSuccess(
  resource: string,
  data: unknown,
  limit?: number,
): Response {
  const count = Array.isArray(data) ? data.length : undefined;
  return Response.json({
    ok: true,
    resource,
    ...(count !== undefined ? { count } : {}),
    ...(limit !== undefined ? { limit } : {}),
    generatedAt: new Date().toISOString(),
    data,
  });
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "Unexpected error";
}

export interface DebugRequestContext {
  supabase: SupabaseClient;
  viewer: DebugViewer;
  // api-key-userの場合のみ設定される。debug_get_*系のRPCへそのまま渡す。
  apiKeyHash?: string;
}

// viewerのaccessTypeに応じて、リソース取得に使うSupabaseクライアントを組み立てる。
// - api-key-user: Cookieなしのanonクライアント。実際のデータ絞り込みはRPC関数側
//   （supabase/migrations/0013_debug_api_access.sql）がAPIキーのハッシュとdebug_api_configを
//   照合して行うため、このクライアント自体はRLSでは何も読めない。
// - cookie-user / development: 既存の通常のCookieベースクライアント（auth.uid()でRLSがスコープ）
async function buildContextForViewer(
  request: Request,
  viewer: DebugViewer,
): Promise<{ supabase: SupabaseClient; apiKeyHash?: string }> {
  if (viewer.accessType === "api-key-user") {
    const providedKey = request.headers.get(DEBUG_API_KEY_HEADER) ?? "";
    return { supabase: createDebugAnonClient(), apiKeyHash: hashApiKey(providedKey) };
  }
  return { supabase: await createClient() };
}

// debug API用のGETハンドラを、アクセス制御・クライアント構築・エラーハンドリング込みでラップする。
// APIキーやスタックトレースなど、内部実装の詳細は返さずエラーメッセージのみを返す。
export function withDebugAuth(
  handler: (request: Request, ctx: DebugRequestContext) => Promise<Response>,
) {
  return async (request: Request): Promise<Response> => {
    let viewer: DebugViewer;
    try {
      viewer = await resolveDebugViewer(request);
    } catch (error) {
      if (error instanceof DebugApiForbiddenError) {
        return Response.json({ ok: false, error: error.message }, { status: 401 });
      }
      if (error instanceof DebugApiMisconfiguredError) {
        return Response.json({ ok: false, error: error.message }, { status: 500 });
      }
      return Response.json(
        { ok: false, error: "アクセス確認中にエラーが発生しました" },
        { status: 500 },
      );
    }

    try {
      const { supabase, apiKeyHash } = await buildContextForViewer(request, viewer);
      return await handler(request, { supabase, viewer, apiKeyHash });
    } catch (error) {
      return Response.json(
        { ok: false, error: extractErrorMessage(error) },
        { status: 500 },
      );
    }
  };
}
