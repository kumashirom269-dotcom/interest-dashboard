import { createClient } from "@/lib/supabase/server";
import type { PreferredLanguage } from "@/lib/language/detectLanguage";

const DEFAULT_PREFERRED_LANGUAGE: PreferredLanguage = "ja";

export async function getPreferredFeedLanguageForUser(): Promise<PreferredLanguage> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("profiles")
    .select("preferred_feed_language")
    .eq("id", user.id)
    .single();

  if (error) throw error;

  return (data?.preferred_feed_language as PreferredLanguage | null) ?? DEFAULT_PREFERRED_LANGUAGE;
}

export async function updatePreferredFeedLanguageForUser(
  language: PreferredLanguage,
): Promise<PreferredLanguage> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("profiles")
    .update({ preferred_feed_language: language })
    .eq("id", user.id)
    .select("preferred_feed_language")
    .single();

  if (error) throw error;

  return data.preferred_feed_language as PreferredLanguage;
}
