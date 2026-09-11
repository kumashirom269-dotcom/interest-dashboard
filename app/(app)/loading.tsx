import { PageLoading } from "@/components/ui/PageLoading";

// (app)配下への遷移中、データ取得が完了するまでNext.jsが自動的にこの内容を
// 表示する（App Routerのloading.tsx規約）。各ページ配下により具体的な
// 文言のloading.tsxがある場合はそちらが優先される。ヘッダー・ナビ自体は
// レイアウト側で維持されたままなので、これはページ本体部分のみの表示。
export default function AppLoading() {
  return <PageLoading message="読み込んでいます..." />;
}
