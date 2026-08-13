// high/criticalジャンルの独立ソース数チェックを「記事クラスタ単位」ではなく
// 「主張（同じ危険物質・症状・対応を述べているか）単位」で行うための、決定的な
// キーワードベースの主張キー抽出（レビュー指摘#2）。
//
// 本来は意味的な主張の一致判定にはAI・埋め込みベクトル等が必要だが、追加のAI呼び出しを
// 増やさない方針のため、既知の危険物質・対象動物のキーワード一致による近似実装とする。
// 一致しない場合はnullを返し、呼び出し側はクラスタ単位の従来判定にフォールバックする
// （この近似はあくまで「別々に見つかった記事が同じ危険物質を論じている場合に、
// 独立ソースとして合算できるようにする」ためのものであり、完全な意味理解ではない）。
const PET_HAZARD_SUBSTANCE_KEYWORDS: { key: string; pattern: RegExp }[] = [
  { key: "onion_garlic", pattern: /玉ねぎ|玉葱|ねぎ類|ニンニク|にんにく/ },
  { key: "chocolate", pattern: /チョコレート|チョコ/ },
  { key: "grape_raisin", pattern: /ぶどう|ブドウ|レーズン/ },
  { key: "xylitol", pattern: /キシリトール/ },
  { key: "lily", pattern: /ユリ|百合/ },
  { key: "avocado", pattern: /アボカド/ },
  { key: "human_medication", pattern: /人用医薬品|人の薬|人薬|医薬品の誤飲|薬の誤飲|人用の薬/ },
  { key: "alcohol", pattern: /アルコール中毒|飲酒/ },
  { key: "caffeine", pattern: /カフェイン/ },
  { key: "macadamia", pattern: /マカダミアナッツ|マカダミア/ },
  // 実データ検証で、国民生活センター等の公的機関発表に多い「家庭用薬品の誤飲」が
  // どの既存キーワードにも一致せず、主張キーによる独立ソース合算の対象にならないことが
  // 判明したため追加。
  { key: "household_chemical", pattern: /洗剤|殺虫剤|漂白剤|除菌剤|消毒液|除草剤/ },
  { key: "tobacco_nicotine", pattern: /タバコ|たばこ|ニコチン/ },
];

const PET_SPECIES_KEYWORDS: { key: string; pattern: RegExp }[] = [
  { key: "dog", pattern: /犬|イヌ|ワンちゃん/ },
  { key: "cat", pattern: /猫|ネコ|ねこ/ },
];

// 実データ検証で、動物病院の獣医師が執筆する記事は「玉ねぎ・チョコレート・ぶどう…」を
// 1本の記事内でまとめて解説する網羅型コラム（例:「危険な食べ物一覧」）が非常に多く、
// PET_HAZARD_SUBSTANCE_KEYWORDSの最初に一致した物質だけをキーにすると、同じ趣旨の記事同士
// でも別々の主張キーに分かれてしまい、独立ソースとして合算できないことが判明した。
// 特定の物質名までは分からなくても「中毒・誤食」と「危険な食べ物一覧」的な文脈が
// 揃っている場合は、種別を問わない緩いバケットとして合算できるようにする
// （個別の危険物質の一致より弱い近似だが、null（合算対象外）よりは実態に近い）。
const PET_GENERAL_FOOD_HAZARD_OVERVIEW_PATTERN =
  /(中毒|誤食|誤飲).{0,15}(危険な食べ物|食べてはいけない|危険な食材)|(危険な食べ物|食べてはいけない|危険な食材).{0,15}(中毒|誤食|誤飲)/;

// genreIdごとの主張キー抽出関数レジストリ。今回はpets_animalsのみ対応。
const CLAIM_KEY_EXTRACTORS: Record<string, (title: string, summary: string) => string | null> = {
  pets_animals: (title, summary) => {
    const text = `${title} ${summary}`;
    const species = PET_SPECIES_KEYWORDS.find((s) => s.pattern.test(text));
    const substance = PET_HAZARD_SUBSTANCE_KEYWORDS.find((s) => s.pattern.test(text));
    if (substance) {
      return species ? `${substance.key}:${species.key}` : substance.key;
    }
    if (PET_GENERAL_FOOD_HAZARD_OVERVIEW_PATTERN.test(text)) {
      return species ? `general_food_hazard_overview:${species.key}` : "general_food_hazard_overview";
    }
    return null;
  },
};

export function extractHazardClaimKey(genreId: string, title: string, summary: string): string | null {
  const extractor = CLAIM_KEY_EXTRACTORS[genreId];
  if (!extractor) return null;
  return extractor(title, summary);
}
