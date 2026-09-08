import type { CapacitorConfig } from "@capacitor/cli";

// iPhoneアプリ化の設定。このアプリはServer Actions・Cookieベースの認証（Supabase Auth）・
// サーバー側レンダリングを多用しているため、Capacitorで静的ファイルをアプリ内に
// バンドルする方式（webDirをビルド出力にする方式）は使わない。代わりに、実際にデプロイした
// 本番URLをネイティブのWebView（WKWebView）でそのまま開く「server.url」方式を使う。
// これにより、Webアプリ側のコード（Server Actions・Cookie認証・RLS等）は一切変更せずに
// そのままiPhoneアプリとして動作する。
//
// server.url は「デプロイ後の本番URL」に必ず書き換えること（後述のREADME_IOS_APP.md参照）。
// 未デプロイの間は仮のプレースホルダーのままにしてあるため、このままではXcodeで
// ビルドしても白い画面のままになる。
const config: CapacitorConfig = {
  appId: "com.interestdashboard.app",
  appName: "Antenna",
  webDir: "www",
  server: {
    // Vercel本番URL（2026年8月デプロイ）。Webアプリを再デプロイしても、このURL自体は
    // 変わらない（vercel --prodのたびに同じProductionエイリアスへ向き直る）ため、
    // 通常はこの値を書き換える必要はない。
    url: "https://interest-dashboard-nine.vercel.app",
    // 本番URLは常にhttps前提のため、平文http通信は許可しない。
    cleartext: false,
  },
  ios: {
    // ノッチ・ホームインジケーター周辺の余白は、アプリ側（globals.css・env(safe-area-inset-*)）
    // のCSSで完全に対応する。そのためcontentInsetは"never"にし、ネイティブ側
    // （UIScrollView.contentInsetAdjustmentBehavior）による自動調整を無効化する
    // （Capacitor公式のデフォルトも"never"。以前"automatic"にしていたところ、
    // ネイティブ側の自動調整とCSS側のsafe-area対応が競合し、ヘッダーがステータスバーと
    // 重なって表示される不具合が実機検証で見つかったため、デフォルトへ戻した）。
    contentInset: "never",
    // 外部リンク（記事の元URL等）をアプリ内WebViewでそのまま開けるようにする
    // （Safariへ都度離脱させない。Server Actionsの動作にも影響しない）。
    allowsLinkPreview: false,
  },
};

export default config;
