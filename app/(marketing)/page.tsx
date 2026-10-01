import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// ログイン済みのユーザーがトップページ（Capacitorアプリ起動時に開かれるURL）に
// 来た場合は、案内画面を見せずそのままマイページへ送る。app/(app)/layout.tsxの
// 「未ログインなら/loginへ」の逆のガードで、「アプリを開くたびにログインし直す
// のが面倒」という指摘への対応（レビュー指摘: セッション自体は維持されていても、
// このページが常にログイン前の案内を表示する作りだったため、再ログインが
// 必要なように見えていた）。
export default async function TopPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/mypage");
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
      <div className="flex max-w-xl flex-col items-center gap-6">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Antenna
        </h1>
        <p className="text-base leading-relaxed text-slate-600">
          あなたの趣味・仕事・学習テーマを登録するだけで、AIが情報収集元を判断し、
          関連する記事やニュースを自動で集めます。リアクションするほど、
          あなただけの情報源に育っていきます。
        </p>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/login"
            className="rounded-full bg-slate-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-slate-700"
          >
            ログイン
          </Link>
          <Link
            href="/signup"
            className="rounded-full border border-slate-300 bg-white px-6 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            新規登録
          </Link>
          <Link
            href="/mypage"
            className="rounded-full border border-slate-300 bg-white px-6 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            マイページを見る
          </Link>
        </div>

        <div className="flex gap-4 text-xs text-slate-400">
          <Link href="/terms" className="underline underline-offset-2 hover:text-slate-600">
            利用規約
          </Link>
          <Link href="/privacy" className="underline underline-offset-2 hover:text-slate-600">
            プライバシーポリシー
          </Link>
        </div>
      </div>
    </div>
  );
}
