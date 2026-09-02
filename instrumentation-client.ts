import * as Sentry from "@sentry/nextjs";

// クライアント側（ブラウザ）のエラー監視。Next.js 16の instrumentation-client.ts 規約
// （node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation-client.md）
// に従い、Sentryの旧来のsentry.client.config.tsは使わずここへ直接書く。
//
// NEXT_PUBLIC_SENTRY_DSN未設定（DSN取得前のローカル開発・デプロイ）の間は何もしない。
// 呼び出し自体を丸ごとスキップするため、DSNが無くてもエラーにはならない。
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    // 送信量とコストを抑えるため、全リクエストではなく一部だけトレースする。
    tracesSampleRate: 0.1,
  });
}
