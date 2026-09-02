import Link from "next/link";

export default function TopPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
      <div className="flex max-w-xl flex-col items-center gap-6">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          関心情報ダッシュボード
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
