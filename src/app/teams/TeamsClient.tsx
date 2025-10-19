"use client";

import {
  OrganizationProfile,
  CreateOrganization,
  useOrganization,
  OrganizationSwitcher,
} from "@clerk/nextjs";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getOrgInviteSuggestions,
  getBackfillEligibleCount,
  backfillGamesForOrg,
  inviteUsersToActiveOrg,
} from "@/server/organizations";

type InviteSuggestion = {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string | null;
};

export default function TeamsClient() {
  const { organization } = useOrganization();
  const [suggestions, setSuggestions] = useState<InviteSuggestion[] | null>(
    null
  );
  const [eligibleCount, setEligibleCount] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const [inviteResult, setInviteResult] = useState<null | {
    invited: number;
    skipped: number;
    alreadyInvited: number;
    errors: { email: string; error: string }[];
  }>(null);

  const hasOrg = Boolean(organization);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!hasOrg) {
        setSuggestions(null);
        setEligibleCount(null);
        setInviteResult(null);
        return;
      }
      try {
        const [sug, count] = await Promise.all([
          getOrgInviteSuggestions(),
          getBackfillEligibleCount(),
        ]);
        if (mounted) {
          setSuggestions(sug);
          setEligibleCount(count);
          setInviteResult(null);
        }
      } catch (e) {
        console.error("Failed loading org migration data", e);
        if (mounted) {
          setSuggestions([]);
          setEligibleCount(0);
          setInviteResult(null);
        }
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [hasOrg, organization?.id]);

  const emailsList = useMemo(() => {
    return (suggestions || [])
      .map((s) => s.email)
      .filter(Boolean)
      .join(", ");
  }, [suggestions]);

  const handleInviteAll = () => {
    if (!suggestions || suggestions.length === 0) return;
    const emails = suggestions.map((s) => s.email).filter(Boolean);
    if (emails.length === 0) return;

    startTransition(async () => {
      try {
        const res = await inviteUsersToActiveOrg(emails);
        setInviteResult(res);

        // Refresh suggestions after inviting (some may be pending now)
        const updated = await getOrgInviteSuggestions();
        setSuggestions(updated);
      } catch (e) {
        console.error("Invites failed", e);
      }
    });
  };

  const handleBackfill = () => {
    startTransition(async () => {
      try {
        const res = await backfillGamesForOrg();
        // Refresh counts
        const count = await getBackfillEligibleCount();
        setEligibleCount(count);
        console.log("Backfill result:", res);
      } catch (e) {
        console.error("Backfill failed", e);
      }
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Organizations</h1>
        <OrganizationSwitcher />
      </div>

      {!organization ? (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            You don&apos;t have an active organization. Create one to get
            started.
          </p>
          <Card>
            <CardContent className="p-4">
              <CreateOrganization />
            </CardContent>
          </Card>
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Organization Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <OrganizationProfile />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Migration Assistant</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <h3 className="font-medium">Invite Suggestions</h3>
                <p className="text-sm text-muted-foreground">
                  We suggest teammates based on your Friends and frequent
                  co-players. Click “Invite All” to send invitations via Clerk.
                </p>
                {suggestions && suggestions.length > 0 ? (
                  <div className="space-y-3">
                    <ul className="list-disc ml-5 text-sm">
                      {suggestions.slice(0, 10).map((s) => (
                        <li key={s.id}>
                          {s.username} — {s.email}
                        </li>
                      ))}
                      {suggestions.length > 10 && (
                        <li className="text-muted-foreground">
                          and {suggestions.length - 10} more…
                        </li>
                      )}
                    </ul>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleInviteAll}
                        disabled={isPending || (suggestions || []).length === 0}
                      >
                        {isPending ? "Inviting…" : "Invite All"}
                      </Button>
                    </div>
                    {inviteResult && (
                      <div className="text-sm text-muted-foreground">
                        <div>Invited: {inviteResult.invited}</div>
                        <div>
                          Skipped (already members): {inviteResult.skipped}
                        </div>
                        <div>
                          Already invited: {inviteResult.alreadyInvited}
                        </div>
                        {inviteResult.errors.length > 0 && (
                          <div className="mt-2">
                            <div className="font-medium text-red-600">
                              Errors:
                            </div>
                            <ul className="list-disc ml-5">
                              {inviteResult.errors.slice(0, 5).map((e, idx) => (
                                <li key={`${e.email}-${idx}`}>
                                  {e.email}: {e.error}
                                </li>
                              ))}
                              {inviteResult.errors.length > 5 && (
                                <li>
                                  …and {inviteResult.errors.length - 5} more
                                </li>
                              )}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    No suggestions yet, or everyone’s already in your org.
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <h3 className="font-medium">Backfill Existing Games</h3>
                <p className="text-sm text-muted-foreground">
                  Import your old games into this organization if all registered
                  players in a game are members of the org. Guest players are
                  allowed.
                </p>
                <div className="flex items-center gap-4">
                  <div className="text-sm">
                    Eligible games:{" "}
                    <span className="font-medium">{eligibleCount ?? "…"}</span>
                  </div>
                  <Button
                    onClick={handleBackfill}
                    disabled={isPending || !eligibleCount}
                  >
                    {isPending ? "Backfilling…" : "Backfill now"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
