import Link from "next/link";
import { SignupForm } from "@/components/auth/SignupForm";

export default function SignupPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-slate-900">新規登録</h1>
        <p className="text-sm text-slate-500">
          メールアドレスとパスワードでアカウントを作成します。
        </p>
      </div>

      <SignupForm />

      <p className="text-center text-sm text-slate-500">
        すでにアカウントをお持ちの方は{" "}
        <Link
          href="/login"
          className="font-medium text-slate-900 underline underline-offset-2"
        >
          ログイン
        </Link>
      </p>
    </div>
  );
}
