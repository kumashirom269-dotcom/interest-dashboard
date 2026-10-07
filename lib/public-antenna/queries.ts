import { createClient } from "@/lib/supabase/server";

export interface PublicAntennaCard {
  id: string;
  title: string;
  summary: string;
  image_url: string | null;
  source_names: string[];
  source_urls: string[];
  created_at: string;
}

export interface PublicAntennaSource {
  name: string;
  url: string;
  source_type: string;
}

export interface PublicAntenna {
  id: string;
  title: string;
  description: string;
  published_at: string | null;
  updated_at: string;
  is_owner: boolean;
  is_following: boolean;
  follower_count: number;
  cards: PublicAntennaCard[];
  sources: PublicAntennaSource[];
}

// 公開アンテナの取得。supabase/migrations/0051_public_antenna.sqlの
// get_public_antenna()（security definer、ホワイトリストした列のみ返す）を
// 呼ぶだけで、anonクライアント（Cookie不要）でも安全に使える。
// 非公開slug・存在しないslugの場合はnullを返す。
export async function getPublicAntennaBySlug(
  slug: string,
): Promise<PublicAntenna | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_antenna", {
    p_slug: slug,
  });

  if (error) throw error;
  if (!data) return null;

  return data as unknown as PublicAntenna;
}

export interface RecentPublicAntenna {
  title: string;
  description: string;
  slug: string;
}

// トップページの導線用。公開日時の新しい順に数件返す（検索・人気順は次フェーズ）。
export async function getRecentPublicAntennas(
  limit = 6,
): Promise<RecentPublicAntenna[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_recent_public_antennas", {
    p_limit: limit,
  });

  if (error) throw error;
  return (data as unknown as RecentPublicAntenna[]) ?? [];
}
