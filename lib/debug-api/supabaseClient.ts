import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

// APIキー認証時に使う、Cookieセッションを持たないSupabaseクライアント（anon key・service_role不使用）。
// このクライアント自体はRLSでは何も読めない（Cookieセッションがないため）。
// データの読み取りは、debug用のSECURITY DEFINER関数（supabase/migrations/0013_debug_api_access.sql）
// をRPC経由で呼び出すことでのみ行う。APIキーのハッシュ照合はDB側のdebug_api_configテーブルと
// 関数内部で行われるため、このクライアント自体に秘密情報を持たせる必要はない。
export function createDebugAnonClient(): SupabaseClient {
  return createSupabaseJsClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false },
    },
  );
}
