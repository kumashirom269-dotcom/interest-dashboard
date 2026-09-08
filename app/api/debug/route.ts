import { withDebugAuth } from "@/lib/debug-api/response";

// debug APIのインデックス。利用可能なエンドポイント一覧を返す（自己記述用）。
export const GET = withDebugAuth(async (request) => {
  const origin = new URL(request.url).origin;

  return Response.json({
    ok: true,
    description:
      "Antennaの状態を確認するための読み取り専用debug API。開発環境、APIキー認証、または認証済みユーザーのみアクセス可能。",
    endpoints: [
      { method: "GET", path: "/api/debug/topics", description: "登録済みトピック一覧" },
      { method: "GET", path: "/api/debug/sources", description: "収集元（sources）一覧" },
      { method: "GET", path: "/api/debug/feed-items", description: "フィード記事一覧（非表示にした記事は除く）" },
      { method: "GET", path: "/api/debug/topic-classifications", description: "トピックのAI分類結果一覧" },
      { method: "GET", path: "/api/debug/saved-items", description: "保存済み記事一覧" },
      { method: "GET", path: "/api/debug/research-results", description: "検索拡張型リサーチ収集の結果一覧（mock/実データ・追加検索・ページ要約取得結果を含む）" },
      { method: "GET", path: "/api/debug/research-plans", description: "AIが立てたリサーチ方針（ResearchPlan）一覧" },
      { method: "GET", path: "/api/debug/vetting-results", description: "リサーチ結果の精査（use/hold/exclude）判定一覧" },
      { method: "GET", path: "/api/debug/recommendation-cards", description: "おすすめカード一覧" },
      { method: "GET", path: "/api/debug/recommendation-card-reactions", description: "おすすめカードへのリアクション（like/bad/save/hide/click）一覧と集計" },
      { method: "GET", path: "/api/debug/source-domain-preferences", description: "research_results由来カードのリアクションから集計した、ユーザー・トピック・ソースドメイン単位の嗜好スコア" },
      { method: "GET", path: "/api/debug/dashboard-summary", description: "全体の概要と、トピックごとの自動収集サマリをまとめて返す" },
      { method: "GET", path: "/api/debug/openapi.json", description: "このAPI群のOpenAPI 3.1スキーマ" },
    ],
    notes: [
      "全エンドポイントは?limit=(既定50, 最大200)に対応",
      "APIキー・secret・service_role等の機密情報は返さない",
      `APIキー認証は x-debug-api-key ヘッダーで行う（開発者本人の確認用の簡易な仕組みであり、不特定多数のユーザー向けではない。将来的にOAuthまたはユーザー別アクセストークン方式へ移行予定）`,
      "Cookieログイン時はSupabaseの行レベルセキュリティにより、APIキー認証時は読み取り専用のSECURITY DEFINER関数により、それぞれアクセス者自身のデータのみ返る",
    ],
    openApiSchemaUrl: `${origin}/api/debug/openapi.json`,
  });
});
