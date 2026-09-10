"use client";

import { useState, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { waitForSessionReady } from "@/lib/supabase/waitForSessionReady";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      // signInWithPassword()のPromiseが解決した直後でも、実機ではセッションの
      // Cookie反映がまだ完了していないことがあり、直後に遷移するとmiddleware側が
      // 未ログイン扱いにしてログイン画面へ押し戻してしまう
      // （lib/supabase/waitForSessionReady.ts参照。SignupForm.tsxと同種の対策）。
      await waitForSessionReady(supabase);
      router.push("/mypage");
      router.refresh();
    } catch {
      // 通信エラー等、Supabase側がエラーオブジェクトとして返せない例外もここで拾う。
      // これが無いと、通信が不安定な環境（実機のWi-Fi等）で例外が投げられた際に
      // submittingがtrueのまま戻らず、「ログイン中...」で永久に固まってしまう。
      setErrorMessage(
        "通信エラーが発生しました。電波状況をご確認のうえ、もう一度お試しください。",
      );
    } finally {
      setSubmitting(false);
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

      <Button type="submit" variant="primary" disabled={submitting}>
        {submitting ? "ログイン中..." : "ログイン"}
      </Button>
    </form>
  );
}
