"use client";

import { useState, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { waitForSessionReady } from "@/lib/supabase/waitForSessionReady";

// メール内リンク方式（クリック確認）は、メールアプリの自動スキャン機能
// （Gmail等が安全性確認のためリンクを事前に一度読み込んでしまう）により、
// 1回限りの確認トークンが本人のタップ前に消費されてしまい、実機検証で
// 繰り返し「リンクが無効です」になる不具合が確認された。
// リンクを一切使わない、確認コード（OTP）を画面に直接入力する方式に変更し、
// この種のトークン消費問題を構造的に回避する。
//
// SupabaseのメールOTPは「最低6桁を保証する」実装であり「常に6桁」ではない
// （生成されるランダム値によっては7桁・8桁になることがある。実機検証で
// 8桁のコードが届く事象を確認済み）。桁数を6固定でハードコードすると、
// それより長いコードが物理的に入力・送信できず詰んでしまうため、
// 下限のみを設けて上限には余裕を持たせる。
const OTP_MIN_LENGTH = 6;
const OTP_MAX_LENGTH = 10;

export function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [awaitingOtp, setAwaitingOtp] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

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

      // 確認済みの既存アカウントと同じメールアドレスでsignUp()すると、Supabaseは
      // セキュリティ上の理由（メールアドレスの存在有無を外部に漏らさないため）で
      // エラーを返さず、あたかも新規登録が成功したかのような応答を返す。ただし
      // その場合はdata.user.identitiesが空配列になるため、これを見て判別する。
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        setErrorMessage(
          "このメールアドレスはすでに登録されています。ログイン画面からログインしてください。",
        );
        return;
      }

      setAwaitingOtp(true);
    } catch {
      setErrorMessage(
        "通信エラーが発生しました。電波状況をご確認のうえ、もう一度お試しください。",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyOtp(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setVerifyingOtp(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: "signup",
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      await waitForSessionReady(supabase);
      router.push("/mypage");
      router.refresh();
    } catch {
      setErrorMessage(
        "通信エラーが発生しました。電波状況をご確認のうえ、もう一度お試しください。",
      );
    } finally {
      setVerifyingOtp(false);
    }
  }

  async function handleResendCode() {
    setErrorMessage(null);
    setResendMessage(null);
    setResending(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resend({ type: "signup", email });
      if (error) {
        setErrorMessage(error.message);
        return;
      }
      setResendMessage("確認コードを再送信しました。");
    } catch {
      setErrorMessage(
        "通信エラーが発生しました。電波状況をご確認のうえ、もう一度お試しください。",
      );
    } finally {
      setResending(false);
    }
  }

  if (awaitingOtp) {
    return (
      <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
        <p className="text-sm text-slate-600">
          <span className="font-medium text-slate-900">{email}</span>{" "}
          宛てに確認コードを送信しました。メールに記載のコードを入力してください。
        </p>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600" htmlFor="otp-code">
            確認コード
          </label>
          <input
            id="otp-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={OTP_MAX_LENGTH}
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="123456"
            className="rounded-md border border-slate-300 px-3 py-2 text-center text-lg tracking-[0.3em] focus:border-slate-500 focus:outline-none"
          />
        </div>

        {errorMessage && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
            {errorMessage}
          </p>
        )}
        {resendMessage && (
          <p className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            {resendMessage}
          </p>
        )}

        <Button
          type="submit"
          variant="primary"
          disabled={verifyingOtp || otpCode.length < OTP_MIN_LENGTH}
        >
          {verifyingOtp ? "確認中..." : "確認する"}
        </Button>

        <div className="flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={handleResendCode}
            disabled={resending}
            className="font-medium text-slate-500 underline underline-offset-2 hover:text-slate-700 disabled:opacity-50"
          >
            {resending ? "再送信中..." : "コードを再送信する"}
          </button>
          <button
            type="button"
            onClick={() => {
              setAwaitingOtp(false);
              setOtpCode("");
              setErrorMessage(null);
              setResendMessage(null);
            }}
            className="font-medium text-slate-500 underline underline-offset-2 hover:text-slate-700"
          >
            メールアドレスを変更する
          </button>
        </div>
      </form>
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
