import { getPreferredFeedLanguageForUser } from "@/lib/profiles/queries";
import { SettingsClient } from "./SettingsClient";

export default async function SettingsPage() {
  const preferredLanguage = await getPreferredFeedLanguageForUser();

  return (
    <div className="mx-auto w-full max-w-5xl">
      <SettingsClient preferredLanguage={preferredLanguage} />
    </div>
  );
}
