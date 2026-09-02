"use client";

import { useState, type SubmitEvent } from "react";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

// パスワード再設定メールの送信画面。Supabase Authの標準フロー
// （resetPasswordForEmail → メール内リンク → /update-password でセッション確立 →
// updateUser）を使う。LoginForm/SignupFormと同様、Server Actionsは経由せず
// ブラウザから直接Supabaseへ呼び出す（Cookieベース認証のセッション確立が絡む
// パスワード再設定フローは、クライアントSDKの標準的な使い方に素直に従う方が
// 実装・デバッグともに単純なため）。
export function RequestPasswordResetForm() {
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setSent(true);
    } catch {
      setErrorMessage(
        "通信エラーが発生しました。電波状況をご確認のうえ、もう一度お試しください。",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <p className="rounded-md bg-emerald-50 px-3 py-3 text-sm text-emerald-700">
        入力されたメールアドレス宛に、パスワード再設定用のリンクを送信しました
        （該当するアカウントが存在する場合のみ届きます）。メール内のリンクを開いて
        新しいパスワードを設定してください。
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-600" htmlFor="email">
          メールアドレス
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
      </div>

      {errorMessage && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          {errorMessage}
        </p>
      )}

      <Button type="submit" variant="primary" disabled={submitting}>
        {submitting ? "送信中..." : "再設定メールを送信"}
      </Button>
    </form>
  );
}
