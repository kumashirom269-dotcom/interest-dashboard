import type { ResearchChannel } from "./types";

export interface ThinContentCheckInput {
  title: string;
  snippet: string | null;
  channel: ResearchChannel | null;
}

export interface ThinContentResult {
  isThin: boolean;
  reasons: string[];
}

// 「予定はありません」「該当する公演はありません」のような、公式サイト・チケットサイトに
// よくある「情報が無いことを示す定型文」。これが含まれる場合は、ページ自体は実在しても
// ユーザーにとって価値がない（＝クリックしても得るものが無い）と判断する。
const NEGATIVE_AVAILABILITY_PATTERNS = [
  /予定はありません/,
  /該当する公演はありません/,
  /現在受付中のチケットはありません/,
  /販売しておりません/,
  /情報がありません/,
  /準備中/,
  /チケットはございません/,
  /公演は終了しました/,
];

const DATE_PATTERN = /\d{1,4}年|\d{1,2}月\d{1,2}日|\d{4}[./-]\d{1,2}([./-]\d{1,2})?/;
// 「チケット」「公演」「受付」「発売」のような単語だけを拾うと、ticket_site/event_siteの
// ページはタイトル自体に必ずこれらの語を含む（そのページの分類名でもあるため）ため、
// 具体的な中身が無い空ページも「有」と誤判定してしまう（実際にe+のチケット確認ページで
// この誤判定が発生した）。そのため、実際に販売・開催の状態を示す、より具体的な
// 語句・会場種別語のみを対象にする。
const VENUE_OR_SALE_KEYWORD_PATTERN =
  /ホール|アリーナ|スタジアム|劇場|会場|開場|開演|発売中|受付中|先行受付|一般発売|完売|残席|座席/;

const MIN_CONTENT_LENGTH = 15;

const EVENT_LIKE_CHANNELS: ResearchChannel[] = ["event_site", "ticket_site"];

// イベント・チケット系のページが、具体的な公演日・会場・受付・チケット販売情報などを
// 一切含まない「空のページ」かどうかを、タイトル・スニペットの文字列だけで簡易判定する。
// 「公式」「チケット」「イベント」というchannel/ラベルだけで価値があると判断せず、
// 中身の具体性を見るための最小限のルールベースチェック（AI呼び出しは行わない）。
//
// 注意: 「具体的な公演日・会場・受付期間・チケット販売情報・イベント名のいずれも
// 確認できない場合」にthinとする（=すべて欠けている場合。1つでも確認できれば
// thinとはしない。過検出を避けるため）。
export function detectThinOrEmptyResult(input: ThinContentCheckInput): ThinContentResult {
  const reasons: string[] = [];
  const combinedText = `${input.title} ${input.snippet ?? ""}`.trim();

  if (combinedText.length < MIN_CONTENT_LENGTH) {
    reasons.push("title/snippetの情報量が少なすぎる");
  }

  if (NEGATIVE_AVAILABILITY_PATTERNS.some((pattern) => pattern.test(combinedText))) {
    reasons.push("「予定なし」「情報なし」等、内容が無いことを示す表現が含まれる");
  }

  if (input.channel && EVENT_LIKE_CHANNELS.includes(input.channel)) {
    const hasDate = DATE_PATTERN.test(combinedText);
    const hasVenueOrSaleInfo = VENUE_OR_SALE_KEYWORD_PATTERN.test(combinedText);
    if (!hasDate && !hasVenueOrSaleInfo) {
      reasons.push(
        "イベント・チケット系ページなのに、公演日・会場・受付・販売等の具体情報が確認できない",
      );
    }
  }

  return { isThin: reasons.length > 0, reasons };
}
