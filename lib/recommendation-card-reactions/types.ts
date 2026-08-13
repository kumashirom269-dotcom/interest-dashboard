// recommendation_cards（マイページの主役であるおすすめカード）に対するリアクション。
// feed_item用のReactionType（types/domain.ts）とは意図的に別の語彙にしている
// （評価軸が異なるため。likeとbadは互いに排他、saveとhideは独立、clickはトグルではなく
// 記録＋recommendation_cards.click_scoreへの加算として扱う）。
export type RecommendationCardReactionType = "like" | "bad" | "save" | "hide" | "click";

export const RECOMMENDATION_CARD_REACTION_TYPES: RecommendationCardReactionType[] = [
  "like",
  "bad",
  "save",
  "hide",
  "click",
];

// UI上でトグルボタンとして扱うのはlike/bad/save/hideのみ。
// clickは別経路（recordRecommendationCardClick）で記録するため、ボタンには出さない。
export type ToggleableRecommendationCardReactionType = Exclude<
  RecommendationCardReactionType,
  "click"
>;

export const TOGGLEABLE_RECOMMENDATION_CARD_REACTION_TYPES: ToggleableRecommendationCardReactionType[] =
  ["like", "bad", "save", "hide"];

export const RECOMMENDATION_CARD_REACTION_LABELS: Record<
  RecommendationCardReactionType,
  string
> = {
  like: "いいね",
  bad: "バッド",
  save: "保存",
  hide: "非表示",
  click: "クリック",
};
