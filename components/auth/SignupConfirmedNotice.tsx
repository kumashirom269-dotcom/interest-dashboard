"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type CheckState = "checking" | "success" | "invalid";

// メール内の確認リンクから遷移してくる画面。Supabaseのブラウザクライアントは
// detectSessionInUrl（既定でtrue）により、このページのURL（確認用のtoken/codeを
// 含む）から自動的にセッションを確立する。UpdatePasswordForm.tsxと同じパターン。
export function SignupConfirmedNotice() {
  const router = useRouter();
  const [state, setState] = useState<CheckState>("checking");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setState("success");
        setTimeout(() => {
          router.push("/mypage");
          router.refresh();
        }, 1500);
      } else {
        setState("invalid");
      }
    });
  }, [router]);

  if (state === "checking") {
    return <p className="text-sm text-slate-500">確認中...</p>;
  }

  if (state === "invalid") {
    return (
      <div className="flex flex-col gap-3">
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          リンクが無効か、有効期限が切れています。お手数ですが、もう一度新規登録を
          やり直してください。
        </p>
        <Link
          href="/signup"
          className="text-center text-sm font-medium text-slate-900 underline underline-offset-2"
        >
          新規登録をやり直す
        </Link>
      </div>
    );
  }

  return (
    <p className="rounded-md bg-emerald-50 px-3 py-3 text-sm text-emerald-700">
      メールアドレスの確認が完了しました。まもなくマイページへ移動します。
    </p>
  );
}
