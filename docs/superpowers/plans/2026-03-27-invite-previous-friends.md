# Invite Previous Friends Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users invite their pre-Circles Blitzer friends to their active circle with a tap-to-invite flow, surfaced after circle creation and via a persistent dashboard banner.

**Architecture:** A static JSON file maps production Clerk user IDs to their previous friends (extracted from the Neon restore branch). A server action validates the target email against this allowlist before sending a Clerk org invitation. Two entry points (post-creation redirect + dashboard banner) link to a dedicated invite page.

**Tech Stack:** Next.js 15 (App Router), Clerk v7 (`@clerk/nextjs ^7.0.7`), PostHog analytics, ShadCN UI components.

---

## File Structure

### Files to Create

| File | Responsibility |
|------|---------------|
| `src/data/legacy-friends.json` | Static map: Clerk user ID → array of `{ username, email }` |
| `src/server/mutations/circles.ts` | `inviteFriendToCircle` server action with allowlist validation |
| `src/app/circles/invite-friends/page.tsx` | Server component: reads friend map, filters members/pending, passes to client |
| `src/app/circles/invite-friends/InviteFriends.tsx` | Client component: tap-to-invite UI |
| `src/components/InviteFriendsBanner.tsx` | Client component: dismissible dashboard banner |

### Files to Modify

| File | Change |
|------|--------|
| `src/middleware.ts` | Add `/circles/invite-friends` to protected routes |
| `src/app/circles/setup/CircleSetup.tsx` | Redirect to `/circles/invite-friends` on creation, `/dashboard` on invite acceptance |
| `src/app/dashboard/page.tsx` | Add `InviteFriendsBanner` |
| `src/server/mutations/index.ts` | Export `inviteFriendToCircle` |
| `src/server/mutations.ts` | Re-export `inviteFriendToCircle` |

---

## Task 1: Legacy Friends Data File

**Files:**
- Create: `src/data/legacy-friends.json`

- [ ] **Step 1: Create the static friend map**

Copy the pre-generated JSON from `/tmp/legacy-friends.json` into the project:

```bash
mkdir -p src/data
cp /tmp/legacy-friends.json src/data/legacy-friends.json
```

Verify it's valid JSON with 20 keys:

```bash
node -e "const d=require('./src/data/legacy-friends.json'); console.log(Object.keys(d).length, 'users')"
```

Expected: `20 users`

- [ ] **Step 2: Commit**

```bash
git add src/data/legacy-friends.json
git commit -m "$(cat <<'EOF'
feat: add legacy friends data for circle invite flow

Static JSON map of production Clerk user IDs to their previous
Blitzer friends. Extracted from Neon restore branch. Used by
the invite-friends page to show who to invite.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Server Action — inviteFriendToCircle

**Files:**
- Create: `src/server/mutations/circles.ts`
- Modify: `src/server/mutations/index.ts`
- Modify: `src/server/mutations.ts`

- [ ] **Step 1: Create the server action**

Create `src/server/mutations/circles.ts`:

```typescript
"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import posthogClient from "@/app/posthog";
import legacyFriends from "@/data/legacy-friends.json";

const friendMap = legacyFriends as Record<
  string,
  { username: string; email: string }[]
>;

/**
 * Invite a previous Blitzer friend to the active circle.
 * Validates the email is in the caller's legacy friend allowlist.
 */
export async function inviteFriendToCircle(email: string) {
  const { userId, orgId } = await auth();
  const posthog = posthogClient();

  if (!userId) throw new Error("Unauthorized");
  if (!orgId) throw new Error("No active circle");

  // Validate email is in the caller's legacy friend list
  const userFriends = friendMap[userId];
  if (!userFriends || !userFriends.some((f) => f.email === email)) {
    return { success: false, error: "Not in your friends list" };
  }

  try {
    const client = await clerkClient();
    await client.organizations.createOrganizationInvitation({
      organizationId: orgId,
      emailAddress: email,
      role: "org:member",
      inviterUserId: userId,
    });

    posthog.capture({
      distinctId: userId,
      event: "invite_friend_to_circle",
      properties: { organizationId: orgId },
    });

    return { success: true };
  } catch (error: unknown) {
    // Clerk throws an error for duplicate invitations — treat as success
    const isDuplicate =
      error &&
      typeof error === "object" &&
      "errors" in error &&
      Array.isArray((error as { errors: { code: string }[] }).errors) &&
      (error as { errors: { code: string }[] }).errors.some(
        (e) =>
          e.code === "duplicate_record" ||
          e.code === "already_a_member_in_organization"
      );

    if (isDuplicate) {
      return { success: true };
    }

    console.error("Failed to invite friend to circle:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send invitation",
    };
  }
}
```

- [ ] **Step 2: Add to barrel exports**

In `src/server/mutations/index.ts`, add:

```typescript
import { inviteFriendToCircle } from "./circles";
```

And add `inviteFriendToCircle` to the export block.

In `src/server/mutations.ts`, add:

```typescript
// Re-export circle-related mutations
import { inviteFriendToCircle } from "./mutations/circles";
export { inviteFriendToCircle };
```

- [ ] **Step 3: Commit**

```bash
git add src/server/mutations/circles.ts src/server/mutations/index.ts src/server/mutations.ts
git commit -m "$(cat <<'EOF'
feat: add inviteFriendToCircle server action

Sends Clerk org invitation to a previous Blitzer friend.
Validates the target email is in the caller's legacy friend
allowlist before sending. Tracks invite events in PostHog.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Middleware — Protect Invite Route

**Files:**
- Modify: `src/middleware.ts`

- [ ] **Step 1: Add the route to the protected matcher**

In `src/middleware.ts`, add `"/circles/invite-friends"` to the `isProtectedRoute` matcher array:

```typescript
const isProtectedRoute = createRouteMatcher([
  "/dashboard",
  "/insights",
  "/games",
  "/games/new",
  "/games/clone(.*)",
  "/games/legacy",
  "/circles/setup",
  "/circles/invite-friends",
  "/api/chat",
  "/api/dev",
]);
```

- [ ] **Step 2: Update the circle setup route check**

The `isCircleSetupRoute` function must also exempt `/circles/invite-friends` from the orgId redirect, because users land here right after creating a circle (orgId is set, but they shouldn't be redirected away):

```typescript
const isCircleExemptRoute = (pathname: string) =>
  pathname === "/circles/setup" || pathname === "/circles/invite-friends";
```

Update all references from `isCircleSetupRoute` to `isCircleExemptRoute` in the middleware:

```typescript
  if (
    userId &&
    !orgId &&
    !isCircleExemptRoute(req.nextUrl.pathname) &&
    !isPublicGameDetail(req.nextUrl.pathname) &&
    isProtectedRoute(req)
  ) {
    return NextResponse.redirect(new URL("/circles/setup", req.url));
  }
```

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "$(cat <<'EOF'
feat: protect /circles/invite-friends route in middleware

Adds the invite page to protected routes and exempts it from
the circle-required redirect (users arrive here right after
creating a circle).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Invite Friends Page

**Files:**
- Create: `src/app/circles/invite-friends/page.tsx`
- Create: `src/app/circles/invite-friends/InviteFriends.tsx`

- [ ] **Step 1: Create the server component**

Create `src/app/circles/invite-friends/page.tsx`:

```typescript
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
      if (m.publicUserData?.identifier) {
        memberEmails.add(m.publicUserData.identifier);
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
      pendingEmails.add(inv.emailAddress);
    }
    if (page.data.length < 100) break;
    inviteOffset += 100;
  }

  // Filter to only uninvited friends
  const uninvitedFriends = allFriends.filter(
    (f) => !memberEmails.has(f.email) && !pendingEmails.has(f.email)
  );

  return (
    <main className="container mx-auto p-4 max-w-lg py-8">
      <InviteFriends friends={uninvitedFriends} />
    </main>
  );
}
```

- [ ] **Step 2: Create the client component**

Create `src/app/circles/invite-friends/InviteFriends.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useOrganization } from "@clerk/nextjs";
import { inviteFriendToCircle } from "@/server/mutations";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2, UserPlus } from "lucide-react";

type Friend = {
  username: string;
  email: string;
};

interface InviteFriendsProps {
  friends: Friend[];
}

export default function InviteFriends({ friends }: InviteFriendsProps) {
  const router = useRouter();
  const { organization } = useOrganization();
  const [invitedEmails, setInvitedEmails] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const [inviting, setInviting] = useState<string | null>(null);

  const circleName = organization?.name ?? "your circle";

  const handleInvite = async (friend: Friend) => {
    setInviting(friend.email);
    const result = await inviteFriendToCircle(friend.email);

    if (result.success) {
      setInvitedEmails((prev) => new Set(prev).add(friend.email));
      setErrors((prev) => {
        const next = new Map(prev);
        next.delete(friend.email);
        return next;
      });
    } else {
      setErrors((prev) =>
        new Map(prev).set(friend.email, result.error ?? "Failed")
      );
    }
    setInviting(null);
  };

  if (friends.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground mb-4">
            All your previous friends have already been invited!
          </p>
          <Button onClick={() => router.push("/dashboard")}>
            Go to Dashboard
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Invite Friends to {circleName}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          These people were your Blitzer friends before Circles. Tap to invite
          them.
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {friends.map((friend) => {
            const isInvited = invitedEmails.has(friend.email);
            const error = errors.get(friend.email);
            const isLoading = inviting === friend.email;

            return (
              <div
                key={friend.email}
                className={`flex items-center justify-between p-3 border rounded-lg ${
                  isInvited
                    ? "border-green-200 bg-green-50"
                    : "border-[#e6d7c3]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm ${
                      isInvited
                        ? "bg-green-200 text-green-700"
                        : "bg-[#f0e6d2] text-[#5a341f]"
                    }`}
                  >
                    {isInvited
                      ? "✓"
                      : friend.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium text-[#2a0e02]">
                      {friend.username}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {friend.email.length > 25
                        ? friend.email.slice(0, 22) + "..."
                        : friend.email}
                    </div>
                  </div>
                  {error && (
                    <Badge variant="destructive" className="gap-1 text-xs">
                      <XCircle className="h-3 w-3" />
                      {error}
                    </Badge>
                  )}
                </div>
                {!isInvited && (
                  <Button
                    size="sm"
                    disabled={isLoading}
                    onClick={() => handleInvite(friend)}
                    className="bg-[#5a341f] hover:bg-[#3d1a0a]"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Invite"
                    )}
                  </Button>
                )}
                {isInvited && (
                  <span className="text-green-600 text-sm font-medium">
                    Invited
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
      <CardFooter className="flex justify-end">
        <Button onClick={() => router.push("/dashboard")}>Done</Button>
      </CardFooter>
    </Card>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/circles/invite-friends/page.tsx src/app/circles/invite-friends/InviteFriends.tsx
git commit -m "$(cat <<'EOF'
feat: add /circles/invite-friends page

Server component reads legacy friend map, filters out current
members and pending invitations via Clerk API, passes uninvited
friends to client component. Client renders tap-to-invite UI
with loading states and success/error feedback.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: CircleSetup — Post-Creation Redirect

**Files:**
- Modify: `src/app/circles/setup/CircleSetup.tsx`

- [ ] **Step 1: Track whether circle was created vs. joined**

Replace the contents of `src/app/circles/setup/CircleSetup.tsx`:

```typescript
"use client";

import { useState, useEffect } from "react";
import {
  useOrganizationList,
  useOrganization,
  CreateOrganization,
} from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Loader2, Users } from "lucide-react";

type SetupStep = "invitations" | "create" | "done";

interface CircleSetupProps {
  hasCircle: boolean;
}

export default function CircleSetup({ hasCircle }: CircleSetupProps) {
  const router = useRouter();
  const { organization } = useOrganization();
  const { isLoaded, userInvitations } = useOrganizationList({
    userInvitations: { status: "pending" },
  });

  const [step, setStep] = useState<SetupStep>(
    hasCircle ? "done" : "invitations"
  );

  // When org becomes active after accepting an invitation,
  // redirect to dashboard. Circle creation uses Clerk's
  // afterCreateOrganizationUrl to redirect to /circles/invite-friends
  // directly, which survives component remounts.
  useEffect(() => {
    if (organization && step !== "done" && step !== "create") {
      // Org became active while on invitations step = user accepted an invite
      setStep("done");
      router.push("/dashboard");
    }
  }, [organization, step, router]);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const pendingInvitations = userInvitations?.data ?? [];

  const handleAcceptInvitation = async (invitationId: string) => {
    const invitation = pendingInvitations.find(
      (inv) => inv.id === invitationId
    );
    if (!invitation) return;

    try {
      await invitation.accept();
    } catch (error) {
      console.error("Failed to accept invitation:", error);
    }
  };

  return (
    <div className="space-y-6">
      {step === "invitations" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Pending Circle Invitations
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendingInvitations.length === 0 ? (
              <p className="text-muted-foreground">
                No pending invitations. Create your own circle below.
              </p>
            ) : (
              <div className="space-y-3">
                {pendingInvitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <span className="font-medium">
                      {invitation.publicOrganizationData?.name ?? "A circle"}
                    </span>
                    <Button
                      size="sm"
                      onClick={() => handleAcceptInvitation(invitation.id)}
                    >
                      Join
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button variant="outline" onClick={() => setStep("create")}>
              Create a new circle instead
            </Button>
          </CardFooter>
        </Card>
      )}

      {step === "create" && (
        <Card>
          <CardHeader>
            <CardTitle>Create Your Circle</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateOrganization
              skipInvitationScreen={true}
              afterCreateOrganizationUrl="/circles/invite-friends"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

The key changes:
- `CreateOrganization` uses `afterCreateOrganizationUrl="/circles/invite-friends"` — Clerk handles the redirect directly after creation, which survives component remounts and page navigations. No ref needed.
- The `useEffect` only handles the invitation acceptance case (org appears while on the invitations step) and redirects to `/dashboard`.
- The `step !== "create"` guard in the useEffect prevents the effect from racing with Clerk's own redirect during circle creation.

- [ ] **Step 2: Commit**

```bash
git add src/app/circles/setup/CircleSetup.tsx
git commit -m "$(cat <<'EOF'
feat: redirect to invite-friends page after circle creation

Uses a ref to track whether the user created a circle (redirect
to /circles/invite-friends) vs accepted an invitation (redirect
to /dashboard). Users who create circles get the chance to
invite their previous friends.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Dashboard Banner

**Files:**
- Create: `src/components/InviteFriendsBanner.tsx`
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Create the banner client component**

Create `src/components/InviteFriendsBanner.tsx`:

```typescript
"use client";

import { useState, useEffect } from "react";
import { useAuth, useOrganization } from "@clerk/nextjs";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface InviteFriendsBannerProps {
  uninvitedCount: number;
}

export default function InviteFriendsBanner({
  uninvitedCount,
}: InviteFriendsBannerProps) {
  const { userId } = useAuth();
  const { organization } = useOrganization();
  const [dismissed, setDismissed] = useState(true); // default hidden to avoid flash

  const storageKey = `blitzer:invite-banner-dismissed:${userId}:${organization?.id}`;

  useEffect(() => {
    if (userId && organization?.id) {
      const isDismissed = localStorage.getItem(storageKey) === "true";
      setDismissed(isDismissed);
    }
  }, [userId, organization?.id, storageKey]);

  const handleDismiss = () => {
    localStorage.setItem(storageKey, "true");
    setDismissed(true);
  };

  if (dismissed || uninvitedCount === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-[#e6d7c3] bg-[#f7f2e9] p-4 mb-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="font-semibold text-[#2a0e02]">
            Invite your previous Blitzer friends
          </div>
          <div className="text-sm text-[#5a341f] mt-1">
            You have{" "}
            <strong>
              {uninvitedCount} {uninvitedCount === 1 ? "friend" : "friends"}
            </strong>{" "}
            from before Circles who aren&apos;t in this circle yet.
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button size="sm" className="bg-[#5a341f] hover:bg-[#3d1a0a]" asChild>
            <Link href="/circles/invite-friends">Invite</Link>
          </Button>
          <Button size="sm" variant="ghost" onClick={handleDismiss}>
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add banner to dashboard page**

In `src/app/dashboard/page.tsx`, add imports and the banner. The server component computes the uninvited count and passes it down:

```typescript
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
```

- [ ] **Step 3: Commit**

```bash
git add src/components/InviteFriendsBanner.tsx src/app/dashboard/page.tsx
git commit -m "$(cat <<'EOF'
feat: add invite friends banner to dashboard

Shows a dismissible banner when the user has previous Blitzer
friends not yet in the active circle. Dismiss state stored in
localStorage per user+circle. Server component computes the
uninvited count by checking Clerk members and pending invites.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review Checklist

### Spec Coverage

| Spec Requirement | Task |
|-----------------|------|
| Static legacy friend map (JSON file) | Task 1 |
| `inviteFriendToCircle` server action with allowlist validation | Task 2 |
| Add `/circles/invite-friends` to middleware | Task 3 |
| `/circles/invite-friends` page with tap-to-invite UI | Task 4 |
| Filter out members AND pending invitations | Task 4 (server component) |
| Post-creation redirect (not post-acceptance) | Task 5 |
| Dashboard banner with dismiss | Task 6 |
| Banner dismiss in localStorage per user+circle | Task 6 |
| PostHog tracking on invites | Task 2 (server action) |
| Clerk role assumption documented | Spec only (no code needed) |

### Placeholder Scan

No instances of "TBD", "TODO", "implement later", "add validation", "similar to Task N", or steps without code blocks.

### Type Consistency

- `Friend` type is `{ username: string; email: string }` — used consistently in the JSON map, server action validation, page server component, and client component props.
- `inviteFriendToCircle(email: string)` returns `{ success: boolean; error?: string }` — consistent across server action definition and client component usage.
- `uninvitedCount: number` — computed in dashboard server component, passed to `InviteFriendsBannerProps`.
- `friendMap` typed as `Record<string, { username: string; email: string }[]>` — same in server action, invite page, and dashboard.
