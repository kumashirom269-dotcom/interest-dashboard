import { Spinner } from "@/components/ui/Spinner";

interface PageLoadingProps {
  message: string;
}

// 各ルートのloading.tsxから共通で使う、ページ本体部分の読み込み中表示。
// メッセージだけページごとに変えることで、今何を読み込んでいるのかが
// 伝わるようにする（レビュー指摘: 画面遷移中に何も表示が無く、処理が
// 進んでいるのか分からなかった）。
export function PageLoading({ message }: PageLoadingProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-sm text-slate-500">
      <Spinner className="h-6 w-6" />
      <p>{message}</p>
    </div>
  );
}
