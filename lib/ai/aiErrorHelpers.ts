// Anthropic APIのクレジット残高不足・請求関連エラーを検知するためのヘルパー。
// これらのエラーは一時的な障害ではなく「追加購入するまで直らない」性質のものなので、
// 検知した場合は同じ処理を何度もリトライせず、フォールバック（ルールベース・簡易生成）に
// 素早く切り替えるために使う。
const CREDIT_OR_BILLING_ERROR_PATTERNS: RegExp[] = [
  /credit balance is too low/i,
  /plans\s*&\s*billing/i,
  /invalid_request_error/i,
];

function extractMessageText(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  if (typeof e === "object" && e !== null) {
    try {
      return JSON.stringify(e);
    } catch {
      return "";
    }
  }
  return "";
}

export function isAiCreditOrBillingError(e: unknown): boolean {
  const message = extractMessageText(e);
  return CREDIT_OR_BILLING_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}
