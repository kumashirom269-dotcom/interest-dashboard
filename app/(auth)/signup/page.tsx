import Link from "next/link";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/auth/SignupForm";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth/safeNextPath";

interface SignupPageProps {
  searchParams: Promise<{ next?: string }>;
}

// 既にログイン済みのままこの画面に来た場合も、フォームを見せずマイページへ送る。
// next対応についてはapp/(auth)/login/page.tsxと同じ方針。
export default async function SignupPage({ searchParams }: SignupPageProps) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(next) ?? "/mypage";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect(nextPath);
  }

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
