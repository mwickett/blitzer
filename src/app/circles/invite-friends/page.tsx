import { redirect } from "next/navigation";

// Preserve bookmarks to the retired legacy-friend invitation flow.
export default function InviteFriendsPage() {
  redirect("/dashboard");
}
