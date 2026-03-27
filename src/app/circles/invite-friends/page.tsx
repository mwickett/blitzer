import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import legacyFriends from "@/data/legacy-friends.json";
import InviteFriends from "./InviteFriends";

const friendMap = legacyFriends as Record<
  string,
  { username: string; email: string }[]
>;

export default async function InviteFriendsPage() {
  const { userId, orgId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  if (!orgId) {
    redirect("/circles/setup");
  }

  // Get this user's previous friends from the static map
  const allFriends = friendMap[userId] ?? [];

  if (allFriends.length === 0) {
    redirect("/dashboard");
  }

  // Get ALL current circle members (paginate — Clerk defaults to 10 per page)
  const client = await clerkClient();
  const memberEmails = new Set<string>();
  let memberOffset = 0;
  while (true) {
    const page = await client.organizations.getOrganizationMembershipList({
      organizationId: orgId,
      limit: 100,
      offset: memberOffset,
    });
    for (const m of page.data) {
      const email = m.publicUserData?.identifier;
      if (email) {
        memberEmails.add(email.toLowerCase());
      }
    }
    if (page.data.length < 100) break;
    memberOffset += 100;
  }

  // Get ALL pending invitations (paginate)
  const pendingEmails = new Set<string>();
  let inviteOffset = 0;
  while (true) {
    const page = await client.organizations.getOrganizationInvitationList({
      organizationId: orgId,
      status: ["pending"],
      limit: 100,
      offset: inviteOffset,
    });
    for (const inv of page.data) {
      pendingEmails.add(inv.emailAddress.toLowerCase());
    }
    if (page.data.length < 100) break;
    inviteOffset += 100;
  }

  // Filter to only uninvited friends (case-insensitive email comparison)
  const uninvitedFriends = allFriends.filter(
    (f) =>
      !memberEmails.has(f.email.toLowerCase()) &&
      !pendingEmails.has(f.email.toLowerCase())
  );

  return (
    <main className="container mx-auto p-4 max-w-lg py-8">
      <InviteFriends friends={uninvitedFriends} />
    </main>
  );
}
