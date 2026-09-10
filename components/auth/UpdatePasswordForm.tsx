"use client";

import { useEffect, useState, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

type SessionCheckState = "checking" | "valid" | "invalid";

// パスワード再設定メールのリンクから遷移してくる画面。
// Supabaseのブラウザクライアントは detectSessionInUrl（既定でtrue）により、
// このページのURL（recovery用のtoken/codeを含む）から自動的にセッションを確立する。
//
// 単発のgetSession()呼び出しだけだと、URLからのセッション確立処理が完了する前に
// 判定してしまい、実際には有効なリンクなのに「無効」と誤判定する可能性がある
// （SignupConfirmedNotice.tsxで確認済みの実機不具合と同種。こちらは対策が漏れて
// いたため合わせて修正）。onAuthStateChangeでSIGNED_INイベントも合わせて監視し、
// 一定時間（4秒）は待ってから最終的に判定する。
const INVALID_LINK_TIMEOUT_MS = 4000;

export function UpdatePasswordForm() {
  const router = useRouter();
  const [sessionState, setSessionState] = useState<SessionCheckState>("checking");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let settled = false;

    function markValid() {
      if (settled) return;
      settled = true;
      setSessionState("valid");
    }

    // detectSessionInUrlによる非同期のセッション確立が完了するとSIGNED_INが発火する。
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") markValid();
    });

    // 既にセッションが確立済み（判定タイミングによってはこちらが先に完了する）の
    // 場合にも対応する。
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) markValid();
    });

    // 上記のいずれでも一定時間内に確立できなければ、リンク自体が無効/期限切れと判断する。
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        setSessionState("invalid");
      }
    }, INVALID_LINK_TIMEOUT_MS);

    return () => {
      authListener.subscription.unsubscribe();
      clearTimeout(timeout);
    };
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
