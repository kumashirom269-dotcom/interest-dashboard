// ログイン・新規登録後の「戻り先」として安全に使えるパスかどうかを判定する。
// 公開アンテナ(/a/[slug])でフォロー・コピーしようとした未ログインユーザーを
// /login?next=/a/xxxxのように誘導し、ログイン後に元のページへ戻すために使う。
//
// 絶対URL（https://evil.example.com等）や、"//evil.example.com"のような
// プロトコル相対URLを許可するとopen redirect脆弱性になるため、
// 「"/"で始まり、"//"では始まらない」相対パスのみを許可する。
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  return value;
}
