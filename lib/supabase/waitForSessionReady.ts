import type { createClient } from "@/lib/supabase/client";

// verifyOtp()やsignInWithPassword()のPromiseが解決した直後でも、実機
// （特にCapacitorのWKWebView）ではセッションのCookie反映がまだ完了していない
// ことがあり、その状態のままprotectedなページへ遷移すると、middleware側
// （lib/supabase/middleware.ts）が未ログイン扱いにしてログイン画面へ押し戻して
// しまう。SignupConfirmedNotice.tsxで確認済みの問題と同種のもので、フォーム
// 送信ハンドラ（SignupForm.tsx・LoginForm.tsx）側では未対応だった。
//
// getSession()で実際にセッションが読み出せることを短い間隔でリトライ確認して
// から遷移することで、この種の押し戻しを防ぐ。セッションがすぐ読み出せる
// 通常のケースでは1回目のチェックで即座に抜けるため、体感速度への影響はない。
export async function waitForSessionReady(
  supabase: ReturnType<typeof createClient>,
  { retries = 10, intervalMs = 200 }: { retries?: number; intervalMs?: number } = {},
): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) return true;
    if (i < retries - 1) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
  return false;
}
