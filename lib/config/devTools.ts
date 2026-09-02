// 開発中の動作確認用に作った操作（AI再分類の手動再実行、サンプル収集元の追加、
// RSS手動取得等）を、一般公開後にエンドユーザーへ見せない・実行させないためのフラグ。
// Next.jsはprocess.env.NODE_ENVをビルド時に静的置換するため、"use client"コンポーネントで
// importしても問題なく動作する（クライアントバンドルにも安全に埋め込まれる）。
//
// Server Actions側（app/(app)/*/actions.ts）でも同じ定数を使い、UIを隠すだけでなく
// 呼び出し自体も本番環境では拒否する（devtoolsボタンを消しても、Server Actionは
// URLさえわかれば直接呼び出せてしまうため、両方でガードする）。
export const DEV_TOOLS_ENABLED = process.env.NODE_ENV !== "production";
