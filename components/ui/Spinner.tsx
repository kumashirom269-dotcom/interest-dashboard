interface SpinnerProps {
  className?: string;
}

// ボタン内のインライン表示にも、画面遷移中の全体表示にも使い回せる、
// くるくる回るだけの最小限のスピナー。サイズ・色はclassNameで調整する想定。
export function Spinner({ className = "" }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="読み込み中"
      className={`inline-block animate-spin rounded-full border-2 border-slate-300 border-t-slate-900 ${className}`}
    />
  );
}
