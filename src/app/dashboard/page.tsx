import {
  getPlayerBattingAverage,
  getHighestAndLowestScore,
  getCumulativeScore,
  getLongestAndShortestGamesByRounds,
} from "@/server/queries";
import { auth, clerkClient } from "@clerk/nextjs/server";
import legacyFriends from "@/data/legacy-friends.json";
import BasicStatBlock from "@/components/BasicStatBlock";
import InviteFriendsBanner from "@/components/InviteFriendsBanner";

const friendMap = legacyFriends as Record<
  string,
  { username: string; email: string }[]
>;

export default async function Dashboard() {
  const battingAverage = await getPlayerBattingAverage();
  const { highest, lowest } = await getHighestAndLowestScore();
  const cumulativeScore = await getCumulativeScore();
  const { longest, shortest } = await getLongestAndShortestGamesByRounds();

  // Compute uninvited friend count for the banner
  // Paginate Clerk API calls (defaults to 10 per page)
  let uninvitedCount = 0;
  const { userId, orgId } = await auth();
  if (userId && orgId) {
    const allFriends = friendMap[userId] ?? [];
    if (allFriends.length > 0) {
      const client = await clerkClient();

      const memberEmails = new Set<string>();
      let memberOffset = 0;
      while (true) {
        const page =
          await client.organizations.getOrganizationMembershipList({
            organizationId: orgId,
            limit: 100,
            offset: memberOffset,
          });
        for (const m of page.data) {
          if (m.publicUserData?.identifier) {
            memberEmails.add(m.publicUserData.identifier);
          }
        }
        if (page.data.length < 100) break;
        memberOffset += 100;
      }

      const pendingEmails = new Set<string>();
      let inviteOffset = 0;
      while (true) {
        const page =
          await client.organizations.getOrganizationInvitationList({
            organizationId: orgId,
            status: ["pending"],
            limit: 100,
            offset: inviteOffset,
          });
        for (const inv of page.data) {
          pendingEmails.add(inv.emailAddress);
        }
        if (page.data.length < 100) break;
        inviteOffset += 100;
      }

      uninvitedCount = allFriends.filter(
        (f) => !memberEmails.has(f.email) && !pendingEmails.has(f.email)
      ).length;
    }
  }

  return (
    <section className="border-zinc-500 p-5">
      <InviteFriendsBanner uninvitedCount={uninvitedCount} />
      <div className="mb-4">
        <BasicStatBlock
          label="Batting Average"
          value={battingAverage.battingAverage}
          details={
            <div>
              <div className="flex items-center justify-between">
                <div className="text-base text-gray-400">Rounds Won</div>
                <div className="text-base font-medium">
                  {battingAverage.totalHandsWon}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-base text-gray-400">Rounds Played</div>
                <div className="text-base font-medium">
                  {battingAverage.totalHandsPlayed}
                </div>
              </div>
            </div>
          }
        />
      </div>
      <div className="mb-4">
        <BasicStatBlock
          label="High / Low Single Hand"
          value={`${highest?.score ?? null} / ${lowest?.score ?? null}`}
        />
      </div>
      <div className="mb-4">
        <BasicStatBlock
          label="Total Cumulative Score"
          value={cumulativeScore.toString()}
        />
      </div>
      <div className="mb-4">
        <BasicStatBlock
          label="Longest / Shortest Game (Rounds)"
          value={`${longest ? longest.roundCount : 0} / ${shortest ? shortest.roundCount : 0}`}
        />
      </div>
    </section>
  );
}
