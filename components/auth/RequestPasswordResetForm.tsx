"use client";

import { useState, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { createClient } from "@/lib/supabase/client";
import { waitForSessionReady } from "@/lib/supabase/waitForSessionReady";

// パスワード再設定メールの送信画面。
//
// 以前はリンク方式（resetPasswordForEmail → メール内リンク → /update-password で
// セッション確立）だったが、メールアプリの自動スキャン機能（Gmail等が安全性確認の
// ためリンクを事前に一度読み込んでしまう）により、1回限りの確認トークンが本人の
// タップ前に消費されてしまい、実機で「リンクが無効/期限切れ」になる不具合が確認
// された。SignupForm.tsxの新規登録確認メールで既に解決済みの問題と同種のため、
// 同じ対策（リンクを使わない、確認コード（OTP）を画面に直接入力する方式）に統一する。
//
// 前提: Supabase側の「Reset Password」メールテンプレートが{{ .Token }}を含む内容に
// なっている必要がある（Authentication → Emails → Templates → Reset Password）。
// デフォルトのリンクのみのテンプレートのままだと、コードがメールに含まれない。
const OTP_MIN_LENGTH = 6;
const OTP_MAX_LENGTH = 10;

type RequestPhase = "idle" | "submitting";
type VerifyPhase = "idle" | "verifying" | "navigating";

const VERIFY_PHASE_LABELS: Record<Exclude<VerifyPhase, "idle">, string> = {
  verifying: "確認中...",
  navigating: "パスワード再設定画面へ移動しています...",
};

export function RequestPasswordResetForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [requestPhase, setRequestPhase] = useState<RequestPhase>("idle");

  const [awaitingOtp, setAwaitingOtp] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [verifyPhase, setVerifyPhase] = useState<VerifyPhase>("idle");
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setRequestPhase("submitting");

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      });

      if (error) {
        setErrorMessage(error.message);
        setRequestPhase("idle");
        return;
      }

      setAwaitingOtp(true);
      setRequestPhase("idle");
    } catch {
      setErrorMessage(
        "通信エラーが発生しました。電波状況をご確認のうえ、もう一度お試しください。",
      );
      setRequestPhase("idle");
    }
  }

  async function handleVerifyOtp(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setVerifyPhase("verifying");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: "recovery",
      });

      if (error) {
        setErrorMessage(error.message);
        setVerifyPhase("idle");
        return;
      }

      // verifyOtp()の成功でセッションが確立される（updateUser()でパスワード変更する
      // ための前提条件）。SignupForm.tsx/LoginForm.tsxと同種の対策として、実機での
      // Cookie反映待ちをしてから遷移する。
      setVerifyPhase("navigating");
      await waitForSessionReady(supabase);
      router.push("/update-password");
      router.refresh();
    } catch {
      setErrorMessage(
        "通信エラーが発生しました。電波状況をご確認のうえ、もう一度お試しください。",
      );
      setVerifyPhase("idle");
    }
  }

  async function handleResendCode() {
    setErrorMessage(null);
    setResendMessage(null);
    setResending(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      });
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
          宛てに確認コードを送信しました（該当するアカウントが存在する場合のみ届きます）。メールに記載のコードを入力してください。
        </p>

        <div className="flex flex-col gap-1">
          <label
            className="text-xs font-medium text-slate-600"
            htmlFor="reset-otp-code"
          >
            確認コード
          </label>
          <input
            id="reset-otp-code"
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
          disabled={verifyPhase !== "idle" || otpCode.length < OTP_MIN_LENGTH}
        >
          {verifyPhase !== "idle" && <Spinner className="h-3.5 w-3.5" />}
          {verifyPhase === "idle" ? "確認する" : VERIFY_PHASE_LABELS[verifyPhase]}
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
              setVerifyPhase("idle");
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

      {errorMessage && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          {errorMessage}
        </p>
      )}

      <Button
        type="submit"
        variant="primary"
        disabled={requestPhase !== "idle"}
      >
        {requestPhase !== "idle" && <Spinner className="h-3.5 w-3.5" />}
        {requestPhase === "idle" ? "確認コードを送信" : "送信中..."}
      </Button>
    </form>
  );
}
