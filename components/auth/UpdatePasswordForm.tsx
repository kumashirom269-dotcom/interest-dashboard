"use client";

import { useEffect, useState, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

type SessionCheckState = "checking" | "valid" | "invalid";

// パスワード再設定メールのリンクから遷移してくる画面。
// Supabaseのブラウザクライアントは detectSessionInUrl（既定でtrue）により、
// このページのURL（recovery用のtoken/codeを含む）から自動的にセッションを確立する。
// そのため、ここでは「セッションが確立できたか」をmount時に確認するだけでよく、
// URLのtoken/codeを自前でパースする必要は無い。
export function UpdatePasswordForm() {
  const router = useRouter();
  const [sessionState, setSessionState] = useState<SessionCheckState>("checking");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSessionState(session ? "valid" : "invalid");
    });
  }, []);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setDone(true);
      setTimeout(() => {
        router.push("/mypage");
        router.refresh();
      }, 1500);
    } catch {
      setErrorMessage(
        "通信エラーが発生しました。電波状況をご確認のうえ、もう一度お試しください。",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (sessionState === "checking") {
    return <p className="text-sm text-slate-500">確認中...</p>;
  }

  if (sessionState === "invalid") {
    return (
      <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
        リンクが無効か、有効期限が切れています。お手数ですが、再度パスワード再設定を
        リクエストしてください。
      </p>
    );
  }

  if (done) {
    return (
      <p className="rounded-md bg-emerald-50 px-3 py-3 text-sm text-emerald-700">
        パスワードを更新しました。まもなくマイページへ移動します。
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-600" htmlFor="password">
          新しいパスワード
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
      </div>

      {errorMessage && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          {errorMessage}
        </p>
      )}

      <Button type="submit" variant="primary" disabled={submitting}>
        {submitting ? "更新中..." : "パスワードを更新"}
      </Button>
    </form>
  );
}
