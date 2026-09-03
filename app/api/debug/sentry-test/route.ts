// Sentry導入直後の動作確認用エンドポイント。確認が終わったら削除する。
export async function GET() {
  throw new Error("Sentry動作確認用のテストエラーです（意図的に発生させています）");
}
