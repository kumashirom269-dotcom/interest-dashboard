import { PageLoading } from "@/components/ui/PageLoading";

// ログイン済みならマイページへ自動遷移するガード（page.tsx側）がログイン状態を
// 確認している間、この表示が出る。これが無いと、ログイン直後に一瞬/loginを
// 経由する際に空白の画面が挟まり、エラーのように見えてしまう（レビュー指摘）。
export default function AuthLoading() {
  return <PageLoading message="確認しています..." />;
}
