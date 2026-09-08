import type { ReactNode } from "react";
import Link from "next/link";

// ログイン・新規登録・パスワード再設定等の画面から、常にトップページへ戻れるように
// する（レビュー指摘: 新規登録画面まで進んだ後「やっぱり既存アカウントでログイン
// したい」と思っても戻る手段が無かった）。
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 sm:px-6">
      <Link
        href="/"
        className="flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        ← Antenna トップへ戻る
      </Link>
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {children}
      </div>
    </div>
  );
}
