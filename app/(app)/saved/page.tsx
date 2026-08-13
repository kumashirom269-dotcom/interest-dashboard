import {
  getFeedItemsForUser,
  filterSavedFeedItems,
  filterByPreferredLanguage,
} from "@/lib/feed-items/queries";
import { getPreferredFeedLanguageForUser } from "@/lib/profiles/queries";
import { SavedPageClient } from "./SavedPageClient";

export default async function SavedPage() {
  const [feedItems, preferredLanguage] = await Promise.all([
    getFeedItemsForUser(),
    getPreferredFeedLanguageForUser(),
  ]);

  const savedFeedItems = filterByPreferredLanguage(
    filterSavedFeedItems(feedItems),
    preferredLanguage,
  );

  return (
    <div className="mx-auto w-full max-w-5xl">
      <SavedPageClient feedItems={savedFeedItems} />
    </div>
  );
}
