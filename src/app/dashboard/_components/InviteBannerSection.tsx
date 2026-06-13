import { auth, clerkClient } from "@clerk/nextjs/server";
import prisma from "@/server/db/db";
import legacyFriends from "@/data/legacy-friends.json";
import InviteFriendsBanner from "@/components/InviteFriendsBanner";
import { getOrgMemberClerkIds } from "@/server/clerkOrgs";

const friendMap = legacyFriends as Record<
  string,
  { username: string; email: string }[]
>;

const INVITATION_PAGE_SIZE = 100;

async function getCircleMemberEmails(orgId: string): Promise<Set<string>> {
  const memberClerkIds = await getOrgMemberClerkIds(orgId);
  if (memberClerkIds.size === 0) return new Set();

  const memberUsers = await prisma.user.findMany({
    where: { clerk_user_id: { in: [...memberClerkIds] } },
    select: { email: true },
  });
  return new Set(memberUsers.map((u) => u.email.toLowerCase()));
}

async function getPendingInvitationEmails(orgId: string): Promise<Set<string>> {
  const client = await clerkClient();
  const pendingEmails = new Set<string>();
  let offset = 0;

  while (true) {
    const page = await client.organizations.getOrganizationInvitationList({
      organizationId: orgId,
      status: ["pending"],
      limit: INVITATION_PAGE_SIZE,
      offset,
    });
    for (const invitation of page.data) {
      pendingEmails.add(invitation.emailAddress.toLowerCase());
    }
    if (page.data.length < INVITATION_PAGE_SIZE) break;
    offset += INVITATION_PAGE_SIZE;
  }

  return pendingEmails;
}

async function getUninvitedFriendCount(): Promise<number> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return 0;

  const allFriends = friendMap[userId] ?? [];
  if (allFriends.length === 0) return 0;

  const [memberEmails, pendingEmails] = await Promise.all([
    getCircleMemberEmails(orgId),
    getPendingInvitationEmails(orgId),
  ]);

  return allFriends.filter(
    (friend) =>
      !memberEmails.has(friend.email.toLowerCase()) &&
      !pendingEmails.has(friend.email.toLowerCase())
  ).length;
}

// The uninvited-friend count needs two paginated Clerk API sweeps, so it
// lives in its own async component: the dashboard stats render immediately
// and the banner streams in behind a Suspense boundary.
export default async function InviteBannerSection() {
  return <InviteFriendsBanner uninvitedCount={await getUninvitedFriendCount()} />;
}
