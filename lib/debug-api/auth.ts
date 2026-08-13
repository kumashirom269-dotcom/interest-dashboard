import { createHash, timingSafeEqual } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createDebugAnonClient } from "./supabaseClient";

export const DEBUG_API_KEY_HEADER = "x-debug-api-key";

// debug APIへのアクセス種別。
// 現時点の"api-key-user"は、開発者本人が自分のデータを確認するための簡易な仕組みであり、
// 不特定多数のユーザー向けではない。将来サービスを一般公開する際は、OAuthまたは
// ユーザーごとに発行するアクセストークン方式へ移行する想定で、その場合もこの判別型に
// 例えば { accessType: "oauth-user"; userId: string } を追加するだけで済むようにしてある。
export type DebugViewer =
  | { accessType: "development"; userId: string | null }
  | { accessType: "cookie-user"; userId: string }
  | { accessType: "api-key-user"; userId: string };

export class DebugApiForbiddenError extends Error {}
export class DebugApiMisconfiguredError extends Error {}

// 文字列長の違いによるタイミング差を避けるため、固定長のハッシュ同士を比較する。
function safeEqual(a: string, b: string): boolean {
  const hashA = createHash("sha256").update(a).digest();
  const hashB = createHash("sha256").update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

// resources向けRPC（debug_get_topics等）に渡すハッシュ値。DB側のdebug_api_configにも
// 同じアルゴリズムで計算したハッシュを保存しておく必要がある（詳細はmigration参照）。
export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

// x-debug-api-keyヘッダーを検証する。
// 1. Next.js側で.env.localのDEBUG_API_KEYと完全一致するか確認する（不一致なら即401、
//    開発環境かどうかによらずフォールバックしない）。
// 2. 一致した場合のみ、ハッシュ化した値をSECURITY DEFINER関数debug_resolve_user_idに渡し、
//    DB側のdebug_api_config（一般ユーザーからは読み書きできないテーブル）と照合してuser_idを取得する。
//    ここで一致しない場合は、DB側の設定がまだ行われていないとみなし、安全なエラーを返す。
// service_role keyは使用しない（anonキーのみの専用クライアントでRPCを呼ぶ）。
async function resolveApiKeyViewer(request: Request): Promise<DebugViewer | null> {
  const providedKey = request.headers.get(DEBUG_API_KEY_HEADER);
  if (!providedKey) return null;

  const expectedKey = process.env.DEBUG_API_KEY;
  if (!expectedKey || !safeEqual(providedKey, expectedKey)) {
    // キーの値やDEBUG_API_KEYの設定有無はエラーメッセージに含めない
    throw new DebugApiForbiddenError("APIキーが正しくありません。");
  }

  const supabase = createDebugAnonClient();
  const { data: userId, error } = await supabase.rpc("debug_resolve_user_id", {
    p_api_key_hash: hashApiKey(providedKey),
  });

  if (error) throw error;

  if (!userId) {
    throw new DebugApiMisconfiguredError(
      "debug_api_configにこのAPIキーに対応する設定が見つかりません。Supabase SQL Editorでdebug_api_configの設定をご確認ください。",
    );
  }

  return { accessType: "api-key-user", userId };
}

async function resolveCookieViewer(): Promise<DebugViewer | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { accessType: "cookie-user", userId: user.id };
}

// debug APIへのアクセス可否とアクセス種別を判定する。
// x-debug-api-keyヘッダーが送られてきた場合はそれを最優先で検証し、
// 不一致・DB未設定なら（開発環境かどうかによらず）即座に拒否する。
// ヘッダーがない場合はSupabase Cookieセッションを見て、それもなければ
// 開発環境に限り匿名アクセスを許可する（本番環境では拒否）。
export async function resolveDebugViewer(request: Request): Promise<DebugViewer> {
  const apiKeyViewer = await resolveApiKeyViewer(request);
  if (apiKeyViewer) return apiKeyViewer;

  const cookieViewer = await resolveCookieViewer();
  if (cookieViewer) return cookieViewer;

  if (process.env.NODE_ENV !== "production") {
    return { accessType: "development", userId: null };
  }

  throw new DebugApiForbiddenError(
    "この debug API は開発環境、APIキー、または認証済みユーザーのみ利用できます。",
  );
}
