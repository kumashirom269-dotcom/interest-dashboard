import Link from "next/link";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-slate-900">ログイン</h1>
        <p className="text-sm text-slate-500">
          登録済みのメールアドレスとパスワードでログインしてください。
        </p>
      </div>

      <LoginForm />

      <p className="text-center text-sm text-slate-500">
        <Link
          href="/reset-password"
          className="font-medium text-slate-900 underline underline-offset-2"
        >
          パスワードをお忘れですか？
        </Link>
      </p>

      <p className="text-center text-sm text-slate-500">
        アカウントをお持ちでない方は{" "}
        <Link
          href="/signup"
          className="font-medium text-slate-900 underline underline-offset-2"
        >
          新規登録
        </Link>
      </p>
    </div>
  );
}
