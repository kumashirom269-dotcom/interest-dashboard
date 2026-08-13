// ジャンル横断の情報タイプ体系（仕様書5-4準拠）。ジャンルとは独立に、
// 「今どんな種類の出来事が起きているか」を表す軸。8グループ＋トレンド系1グループの
// 計9グループで構成する。1つのトピック/候補は複数の情報タイプを持ちうる。
export type InformationTypeGroup =
  | "product_release"
  | "event_participation"
  | "appearance_person"
  | "facility_shop"
  | "regional_transport_lifeline"
  | "seasonal_nature"
  | "system_recruitment"
  | "safety_caution"
  | "trend";

export const INFORMATION_TYPE_GROUP_LABELS: Record<InformationTypeGroup, string> = {
  product_release: "商品・発売",
  event_participation: "イベント・参加",
  appearance_person: "出演・人物",
  facility_shop: "店舗・施設",
  regional_transport_lifeline: "地域・交通・ライフライン",
  seasonal_nature: "季節・自然",
  system_recruitment: "制度・募集",
  safety_caution: "安全・注意",
  trend: "トレンド・話題",
};

interface InformationTypeDef {
  code: string;
  group: InformationTypeGroup;
  label: string;
}

const RAW_INFORMATION_TYPES: InformationTypeDef[] = [
  // 商品・発売
  { code: "new_product", group: "product_release", label: "新商品" },
  { code: "new_release", group: "product_release", label: "新発売" },
  { code: "preorder_start", group: "product_release", label: "予約開始" },
  { code: "early_sale", group: "product_release", label: "先行販売" },
  { code: "restock", group: "product_release", label: "再入荷" },
  { code: "sold_out", group: "product_release", label: "売り切れ" },
  { code: "discontinued", group: "product_release", label: "販売終了" },
  { code: "reissue", group: "product_release", label: "再販・復刻" },
  { code: "limited", group: "product_release", label: "数量・期間限定" },
  { code: "regional_limited", group: "product_release", label: "地域限定" },
  { code: "seasonal_limited", group: "product_release", label: "季節限定" },
  { code: "collaboration", group: "product_release", label: "コラボレーション" },
  { code: "price_increase", group: "product_release", label: "値上げ" },
  { code: "price_decrease", group: "product_release", label: "値下げ" },
  { code: "sale", group: "product_release", label: "セール" },
  { code: "recall", group: "product_release", label: "回収" },
  { code: "correction", group: "product_release", label: "訂正" },
  { code: "product_accident", group: "product_release", label: "製品事故" },

  // イベント・参加
  { code: "event_announcement", group: "event_participation", label: "イベント告知" },
  { code: "application_start", group: "event_participation", label: "申込開始" },
  { code: "application_deadline", group: "event_participation", label: "申込締切" },
  { code: "ticket_sale", group: "event_participation", label: "チケット発売" },
  { code: "ticket_sold_out", group: "event_participation", label: "チケット完売" },
  { code: "same_day_ticket", group: "event_participation", label: "当日券" },
  { code: "cancellation", group: "event_participation", label: "中止" },
  { code: "postponement", group: "event_participation", label: "延期" },
  { code: "venue_change", group: "event_participation", label: "会場変更" },
  { code: "cast_change", group: "event_participation", label: "出演者変更" },
  { code: "free_event", group: "event_participation", label: "無料イベント" },
  { code: "child_friendly", group: "event_participation", label: "子ども向け" },
  { code: "pet_friendly", group: "event_participation", label: "ペット可" },
  { code: "online_event", group: "event_participation", label: "オンライン開催" },

  // 出演・人物
  { code: "tv_appearance", group: "appearance_person", label: "テレビ出演" },
  { code: "radio_appearance", group: "appearance_person", label: "ラジオ出演" },
  { code: "magazine_feature", group: "appearance_person", label: "雑誌掲載" },
  { code: "interview", group: "appearance_person", label: "インタビュー" },
  { code: "youtube_appearance", group: "appearance_person", label: "YouTube出演" },
  { code: "live_stream", group: "appearance_person", label: "ライブ配信" },
  { code: "catch_up", group: "appearance_person", label: "見逃し配信" },
  { code: "appointment", group: "appearance_person", label: "就任" },
  { code: "resignation", group: "appearance_person", label: "退任・脱退" },
  { code: "award", group: "appearance_person", label: "受賞" },
  { code: "obituary", group: "appearance_person", label: "訃報" },
  { code: "hiatus", group: "appearance_person", label: "活動休止" },
  { code: "return", group: "appearance_person", label: "活動再開" },

  // 店舗・施設
  { code: "opening", group: "facility_shop", label: "開店・開業" },
  { code: "opening_soon", group: "facility_shop", label: "開店予定" },
  { code: "renewal", group: "facility_shop", label: "リニューアル" },
  { code: "relocation", group: "facility_shop", label: "移転" },
  { code: "reopening", group: "facility_shop", label: "再開" },
  { code: "temporary_closure", group: "facility_shop", label: "臨時休業" },
  { code: "permanent_closure", group: "facility_shop", label: "閉店" },
  { code: "business_hours_change", group: "facility_shop", label: "営業時間変更" },
  { code: "reservation_start", group: "facility_shop", label: "予約開始" },
  { code: "congestion", group: "facility_shop", label: "混雑" },
  { code: "entry_restriction", group: "facility_shop", label: "入場制限" },

  // 地域・交通・ライフライン
  { code: "new_route", group: "regional_transport_lifeline", label: "新路線" },
  { code: "timetable_revision", group: "regional_transport_lifeline", label: "ダイヤ改正" },
  { code: "additional_service", group: "regional_transport_lifeline", label: "増便" },
  { code: "service_reduction", group: "regional_transport_lifeline", label: "減便" },
  { code: "suspension", group: "regional_transport_lifeline", label: "運休" },
  { code: "cancellation_transport", group: "regional_transport_lifeline", label: "運行取消" },
  { code: "road_closure", group: "regional_transport_lifeline", label: "通行止め" },
  { code: "congestion_traffic", group: "regional_transport_lifeline", label: "交通渋滞" },
  { code: "traffic_restriction", group: "regional_transport_lifeline", label: "交通規制" },
  { code: "power_outage", group: "regional_transport_lifeline", label: "停電" },
  { code: "water_outage", group: "regional_transport_lifeline", label: "断水" },
  { code: "gas_outage", group: "regional_transport_lifeline", label: "ガス供給停止" },
  { code: "evacuation", group: "regional_transport_lifeline", label: "避難" },
  { code: "disaster", group: "regional_transport_lifeline", label: "災害" },
  { code: "crime_alert", group: "regional_transport_lifeline", label: "防犯情報" },

  // 季節・自然
  { code: "season_start", group: "seasonal_nature", label: "シーズン開始" },
  { code: "first_shipment", group: "seasonal_nature", label: "初出荷" },
  { code: "harvest_start", group: "seasonal_nature", label: "収穫開始" },
  { code: "peak_viewing", group: "seasonal_nature", label: "見頃" },
  { code: "flowering", group: "seasonal_nature", label: "開花" },
  { code: "autumn_leaves", group: "seasonal_nature", label: "紅葉" },
  { code: "snowfall", group: "seasonal_nature", label: "降雪" },
  { code: "mountain_opening", group: "seasonal_nature", label: "山開き" },
  { code: "beach_opening", group: "seasonal_nature", label: "海開き" },
  { code: "seasonal_operation", group: "seasonal_nature", label: "季節営業" },
  { code: "extreme_heat", group: "seasonal_nature", label: "猛暑" },
  { code: "cold_wave", group: "seasonal_nature", label: "寒波" },
  { code: "pollen", group: "seasonal_nature", label: "花粉" },
  { code: "yellow_dust", group: "seasonal_nature", label: "黄砂" },
  { code: "wildlife_sighting", group: "seasonal_nature", label: "野生生物目撃情報" },

  // 制度・募集
  { code: "system_start", group: "system_recruitment", label: "制度開始" },
  { code: "system_change", group: "system_recruitment", label: "制度変更" },
  { code: "subsidy", group: "system_recruitment", label: "補助金" },
  { code: "grant", group: "system_recruitment", label: "助成金" },
  { code: "benefit", group: "system_recruitment", label: "給付" },
  { code: "application_open", group: "system_recruitment", label: "受付開始" },
  { code: "application_deadline_system", group: "system_recruitment", label: "受付締切" },
  { code: "recruitment", group: "system_recruitment", label: "募集" },
  { code: "enrollment", group: "system_recruitment", label: "入会・登録" },
  { code: "vacancy", group: "system_recruitment", label: "空き枠あり" },
  { code: "application_closed", group: "system_recruitment", label: "募集終了" },
  { code: "eligibility_change", group: "system_recruitment", label: "対象条件変更" },

  // 安全・注意
  { code: "warning", group: "safety_caution", label: "警告" },
  { code: "alert", group: "safety_caution", label: "注意喚起" },
  { code: "infectious_disease", group: "safety_caution", label: "感染症" },
  { code: "food_poisoning", group: "safety_caution", label: "食中毒" },
  { code: "adverse_effect", group: "safety_caution", label: "副作用" },
  { code: "poisoning", group: "safety_caution", label: "中毒" },
  { code: "accident", group: "safety_caution", label: "事故" },
  { code: "defect", group: "safety_caution", label: "不具合" },
  { code: "fraud", group: "safety_caution", label: "詐欺" },
  { code: "consumer_trouble", group: "safety_caution", label: "消費者トラブル" },
  { code: "illegal_product", group: "safety_caution", label: "違法製品" },
  { code: "counterfeit", group: "safety_caution", label: "模倣品" },
  { code: "security_incident", group: "safety_caution", label: "セキュリティインシデント" },
  { code: "data_breach", group: "safety_caution", label: "情報漏洩" },

  // トレンド・話題（仕様書には独立グループとして明記されていないが、
  // recommendation_cards.information_typeに既存の sns_trend 等を吸収するために補完）
  { code: "sns_trend", group: "trend", label: "SNSで話題" },
  { code: "viral_topic", group: "trend", label: "バズ・急拡大" },
  { code: "ranking_update", group: "trend", label: "ランキング更新" },
  { code: "creator_post", group: "trend", label: "クリエイター投稿" },
];

export type InformationTypeCode = (typeof RAW_INFORMATION_TYPES)[number]["code"];

export const INFORMATION_TYPES: InformationTypeCode[] = RAW_INFORMATION_TYPES.map((t) => t.code);

export const INFORMATION_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  RAW_INFORMATION_TYPES.map((t) => [t.code, t.label]),
);

export const INFORMATION_TYPE_GROUP_OF: Record<string, InformationTypeGroup> = Object.fromEntries(
  RAW_INFORMATION_TYPES.map((t) => [t.code, t.group]),
);

export function isValidInformationType(value: string): boolean {
  return value in INFORMATION_TYPE_LABELS;
}

export function normalizeInformationTypes(values: string[] | undefined | null): string[] {
  if (!values) return [];
  return values.filter((v) => isValidInformationType(v));
}
