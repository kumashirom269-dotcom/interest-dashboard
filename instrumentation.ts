import * as Sentry from "@sentry/nextjs";

// サーバー側（Node.js / Edge両ランタイム）のエラー監視。Next.js 16の instrumentation.ts
// 規約（node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md）
// に従い、registerでランタイムごとにSentryを初期化し、onRequestErrorでServer Actions・
// Route Handler・レンダリング中の例外をSentryへ送る。
//
// SENTRY_DSN未設定（DSN取得前）の間はSentry.initを呼ばないため、それ以外の挙動には
// 一切影響しない。
export async function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  });
}

// Sentry.captureRequestErrorはSENTRY_DSN未設定でクライアント未初期化の場合も
// 安全に無視される（Sentry SDK側の設計）。
export const onRequestError = Sentry.captureRequestError;
