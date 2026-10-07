import { PageLoading } from "@/components/ui/PageLoading";

// トップページ（ログイン済みならマイページへ自動遷移するガードがある）の
// ログイン状態確認中に表示する。(auth)/loading.tsxと同じ目的。
export default function MarketingLoading() {
  return <PageLoading message="確認しています..." />;
}
