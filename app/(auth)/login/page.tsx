import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { createClient } from "@/lib/supabase/server";

// 既にログイン済みのままこの画面に来た場合（トップページ経由以外でのアクセス等）も、
// フォームを見せずマイページへ送る。
export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/mypage");
  }

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
