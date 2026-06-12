import { clerkClient } from "@clerk/nextjs/server";

const MEMBERSHIP_PAGE_SIZE = 100;

/**
 * Fetch the Clerk user IDs of every member of an organization (circle).
 *
 * Clerk's getOrganizationMembershipList defaults to 10 results per page,
 * so callers that skip pagination silently miss members in larger circles.
 */
export async function getOrgMemberClerkIds(
  organizationId: string
): Promise<Set<string>> {
  const client = await clerkClient();
  const memberIds = new Set<string>();
  let offset = 0;

  while (true) {
    const page = await client.organizations.getOrganizationMembershipList({
      organizationId,
      limit: MEMBERSHIP_PAGE_SIZE,
      offset,
    });

    for (const membership of page.data) {
      const memberId = membership.publicUserData?.userId;
      if (memberId) memberIds.add(memberId);
    }

    if (page.data.length < MEMBERSHIP_PAGE_SIZE) break;
    offset += MEMBERSHIP_PAGE_SIZE;
  }

  return memberIds;
}
