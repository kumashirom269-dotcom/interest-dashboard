import type { NextConfig } from "next";

// 一般公開に向けたセキュリティヘッダー対応。
// nonceベースの厳格なCSP（node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md
// 参照）はページ全体を動的レンダリング必須にする副作用があるため、まずは
// next.config.tsのheaders()で設定できる非nonce版を採用する（同ドキュメントの
// "Without Nonces" セクションに準拠）。
const isDev = process.env.NODE_ENV === "development";

// connect-src: SupabaseへはブラウザのSupabaseクライアント（lib/supabase/client.ts）が
// 直接アクセスするため許可する。プロジェクトのURLはNEXT_PUBLIC_SUPABASE_URLで
// 環境ごとに変わるため、ワイルドカードで許可する。
// img-src: おすすめカードの画像は収集元の任意の外部サイト（og:image等）から
// 取得するため、特定ドメインへの限定はできない。https:全般を許可する。
// font-src: next/font（Geist）はビルド時に自己ホストするため外部フォントは不要。
// script-src/style-src: nonceを使わないため'unsafe-inline'が必要
// （開発時のみReactのデバッグ用に'unsafe-eval'も必要）。
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""};
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: https:;
  font-src 'self' data:;
  connect-src 'self' https://*.supabase.co;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
`
  .replace(/\s{2,}/g, " ")
  .trim();

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: cspHeader },
          // frame-ancestors 'none'（CSP）と重複するが、CSPを解釈しない古いブラウザ向けの
          // 保険としてX-Frame-Optionsも設定する（クリックジャッキング対策）。
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          // VercelはデフォルトでHSTSを付与するが、念のため明示しておく。
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
