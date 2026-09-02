"use client";

import { useState, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

export function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (!agreedToTerms) {
      setErrorMessage("利用規約とプライバシーポリシーへの同意が必要です。");
      return;
    }

    setSubmitting(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({ email, password });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (data.session) {
        // メール確認が不要な設定の場合、signUp直後にセッションが張られる
        router.push("/mypage");
        router.refresh();
        return;
      }

      // メール確認が必要な設定の場合、session はまだ発行されない
      setConfirmationSent(true);
    } catch {
      // 通信エラー等、Supabase側がエラーオブジェクトとして返せない例外もここで拾う。
      // これが無いと、通信が不安定な環境（実機のWi-Fi等）で例外が投げられた際に
      // submittingがtrueのまま戻らず、「登録中...」で永久に固まってしまう。
      setErrorMessage(
        "通信エラーが発生しました。電波状況をご確認のうえ、もう一度お試しください。",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmationSent) {
    return (
      <p className="rounded-md bg-emerald-50 px-3 py-3 text-sm text-emerald-700">
        確認メールを送信しました。メール内のリンクを開いて登録を完了してください。
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
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
      </div>

      <label className="flex items-start gap-2 text-xs text-slate-600">
        <input
          type="checkbox"
          checked={agreedToTerms}
          onChange={(e) => setAgreedToTerms(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          <Link
            href="/terms"
            target="_blank"
            className="font-medium text-slate-900 underline underline-offset-2"
          >
            利用規約
          </Link>
          および
          <Link
            href="/privacy"
            target="_blank"
            className="font-medium text-slate-900 underline underline-offset-2"
          >
            プライバシーポリシー
          </Link>
          に同意します
        </span>
      </label>

      {errorMessage && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          {errorMessage}
        </p>
      )}

      <Button type="submit" variant="primary" disabled={submitting || !agreedToTerms}>
        {submitting ? "登録中..." : "新規登録"}
      </Button>
    </form>
  );
}
