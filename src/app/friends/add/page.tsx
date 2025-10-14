import { isClerkOrgsEnabled } from "@/featureFlags";

import { getFilteredUsers } from "@/server/queries";
import SelectUser from "./SelectUser";

export default async function AddFriend() {
  const useOrgs = await isClerkOrgsEnabled();
  if (useOrgs) {
    return (
      <div className="container mx-auto p-6">
        <div className="p-4 rounded border bg-muted/20 text-sm">
          Friends are replaced by Organizations while this preview flag is enabled. Use the Clerk organization switcher to manage members and invite people.
        </div>
      </div>
    );
  }
  const users = await getFilteredUsers();
  return <SelectUser users={users} />;
}
