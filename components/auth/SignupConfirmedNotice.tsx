"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type CheckState = "checking" | "success" | "invalid";

// メール内の確認リンクから遷移してくる画面。Supabaseのブラウザクライアントは
// detectSessionInUrl（既定でtrue）により、このページのURL（確認用のtoken/codeを
// 含む）から自動的にセッションを確立する。
//
// 単発のgetSession()呼び出しだけだと、URLからのセッション確立処理が完了する前に
// 判定してしまい、実際には有効なリンクなのに「無効」と誤判定する可能性がある
// （実機検証で報告あり）。onAuthStateChangeでSIGNED_INイベントも合わせて監視し、
// 一定時間（4秒）は待ってから最終的に判定する、より安全な実装にした。
const INVALID_LINK_TIMEOUT_MS = 4000;

export function SignupConfirmedNotice() {
  const router = useRouter();
  const [state, setState] = useState<CheckState>("checking");

  useEffect(() => {
    const supabase = createClient();
    let settled = false;

    function markSuccess() {
      if (settled) return;
      settled = true;
      setState("success");
      setTimeout(() => {
        router.push("/mypage");
        router.refresh();
      }, 1500);
    }

    // detectSessionInUrlによる非同期のセッション確立が完了するとSIGNED_INが発火する。
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") markSuccess();
    });

    // 既にセッションが確立済み（判定タイミングによってはこちらが先に完了する）の
    // 場合にも対応する。
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) markSuccess();
    });

    // 上記のいずれでも一定時間内に確立できなければ、リンク自体が無効/期限切れと判断する。
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        setState("invalid");
      }
    }, INVALID_LINK_TIMEOUT_MS);

    return () => {
      authListener.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [router]);

  if (state === "checking") {
    return <p className="text-sm text-slate-500">確認中...</p>;
  }

  if (state === "invalid") {
    return (
      <div className="flex flex-col gap-3">
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          リンクが無効か、有効期限が切れています。メールアプリの自動スキャン機能に
          よってリンクが既に使用済みになっている場合もあります。お手数ですが、もう
          一度新規登録をやり直してください。
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
