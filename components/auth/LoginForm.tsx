"use client";

import { useState, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { createClient } from "@/lib/supabase/client";
import { waitForSessionReady } from "@/lib/supabase/waitForSessionReady";

// ログイン処理は「Supabaseへの認証」→「セッション反映待ち」→「画面遷移」の
// 複数段階からなる（レビュー指摘: ボタンを押した後、何が起きているのか
// ユーザーに伝わらず、押せているのかどうか不安になる）。段階ごとに文言を
// 変えることで、今どこで待たされているのかが分かるようにする。
type LoginPhase = "idle" | "authenticating" | "navigating";

const PHASE_LABELS: Record<Exclude<LoginPhase, "idle">, string> = {
  authenticating: "ログイン中...",
  navigating: "マイページへ移動しています...",
};

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [phase, setPhase] = useState<LoginPhase>("idle");

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setPhase("authenticating");

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        setPhase("idle");
        return;
      }

      // signInWithPassword()のPromiseが解決した直後でも、実機ではセッションの
      // Cookie反映がまだ完了していないことがあり、直後に遷移するとmiddleware側が
      // 未ログイン扱いにしてログイン画面へ押し戻してしまう
      // （lib/supabase/waitForSessionReady.ts参照。SignupForm.tsxと同種の対策）。
      setPhase("navigating");
      await waitForSessionReady(supabase);
      router.push("/mypage");
      router.refresh();
      // ここでphaseを"idle"へ戻さない: 成功時はこのコンポーネント自体が
      // 画面遷移によってアンマウントされる想定のため、あえて「移動しています...」
      // 表示を維持したままにする。以前はfinallyで無条件にリセットしており、
      // 実際の画面遷移が完了する前にボタンが元通りになって「押せていないのでは」
      // と誤解される原因になっていた（レビュー指摘）。
    } catch {
      // 通信エラー等、Supabase側がエラーオブジェクトとして返せない例外もここで拾う。
      // これが無いとphaseが"authenticating"のまま戻らず、ボタンが永久に
      // 固まって見えてしまう。
      setErrorMessage(
        "通信エラーが発生しました。電波状況をご確認のうえ、もう一度お試しください。",
      );
      setPhase("idle");
    }
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

      <div className="flex flex-col gap-1">
        <label
          className="text-xs font-medium text-slate-600"
          htmlFor="password"
        >
          パスワード
        </label>
        <input
          id="password"
          type="password"
          required
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

      <Button type="submit" variant="primary" disabled={phase !== "idle"}>
        {phase !== "idle" && <Spinner className="h-3.5 w-3.5" />}
        {phase === "idle" ? "ログイン" : PHASE_LABELS[phase]}
      </Button>
    </form>
  );
}
