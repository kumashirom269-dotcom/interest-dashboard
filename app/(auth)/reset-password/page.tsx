import Link from "next/link";
import { RequestPasswordResetForm } from "@/components/auth/RequestPasswordResetForm";

export default function ResetPasswordPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-slate-900">
          パスワードの再設定
        </h1>
        <p className="text-sm text-slate-500">
          登録済みのメールアドレスを入力してください。パスワード再設定用のリンクを
          お送りします。
        </p>
      </div>

      <RequestPasswordResetForm />

      <p className="text-center text-sm text-slate-500">
        <Link
          href="/login"
          className="font-medium text-slate-900 underline underline-offset-2"
        >
          ログイン画面に戻る
        </Link>
      </p>
    </div>
  );
}
