// Claudeへ「JSONのみを返す」よう指示しても、実際には以下のようなケースが発生しうる。
// - Markdownコードブロック（```json ... ```）で囲んで返す
// - 前後に説明文が混ざる
// - max_tokensに達して応答が途中で切れる（"Unterminated string in JSON"の典型的な原因）
// 素朴なJSON.parseだけに頼ると、これら1回の失敗で呼び出し元の処理全体が失敗してしまうため、
// 段階的に緩和しながらパースを試み、それでも失敗する場合は例外を投げずに失敗結果を返す
// （呼び出し元が安全側にフォールバックできるようにするため）。
export type ParseAiJsonOutcome<T> =
  | { ok: true; data: T }
  | { ok: false; errorMessage: string; responsePreview: string };

const PREVIEW_HEAD_LENGTH = 200;
const PREVIEW_TAIL_LENGTH = 200;

function stripMarkdownCodeBlock(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function extractBetween(text: string, open: string, close: string): string | null {
  const start = text.indexOf(open);
  const end = text.lastIndexOf(close);
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

// AI応答全文をログ・warningsに出すと機密情報混入や大量出力のリスクがあるため、
// 冒頭・末尾のみを保持する（途中で切れた場合の原因調査には冒頭・末尾で十分なことが多い）。
function buildPreview(text: string): string {
  if (text.length <= PREVIEW_HEAD_LENGTH + PREVIEW_TAIL_LENGTH) return text;
  return `${text.slice(0, PREVIEW_HEAD_LENGTH)} …(中略・全${text.length}文字)… ${text.slice(-PREVIEW_TAIL_LENGTH)}`;
}

// 1. Markdownコードブロックを除去
// 2. 通常のJSON.parseを試みる
// 3. 失敗したら、最初の"{"から最後の"}"までを抽出してparse（オブジェクト形式）
// 4. それでも失敗したら、最初の"["から最後の"]"までを抽出してparse（配列形式）
// 5. すべて失敗したら、例外を投げずに失敗結果（エラー内容＋応答の冒頭・末尾のみ）を返す
//
// 注意: 不完全なJSON（閉じ括弧の補完等）を無理に修復することはしない。
// 壊れたJSONから誤った値を復元して誤判定するより、呼び出し元が安全側（holdなど）に
// 倒せるよう、失敗は失敗として明示的に返す方針。
export function parseAiJsonSafely<T>(rawText: string): ParseAiJsonOutcome<T> {
  const stripped = stripMarkdownCodeBlock(rawText);

  const attempts: string[] = [stripped];

  const objectExtracted = extractBetween(stripped, "{", "}");
  if (objectExtracted && objectExtracted !== stripped) attempts.push(objectExtracted);

  const arrayExtracted = extractBetween(stripped, "[", "]");
  if (arrayExtracted && arrayExtracted !== stripped) attempts.push(arrayExtracted);

  let lastError: unknown = null;
  for (const attempt of attempts) {
    try {
      return { ok: true, data: JSON.parse(attempt) as T };
    } catch (e) {
      lastError = e;
    }
  }

  return {
    ok: false,
    errorMessage: lastError instanceof Error ? lastError.message : "JSON解析に失敗しました",
    responsePreview: buildPreview(rawText),
  };
}
