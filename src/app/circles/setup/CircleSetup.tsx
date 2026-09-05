"use client";

import { useState, useEffect, useRef } from "react";
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

export default function CircleSetup() {
  const router = useRouter();
  const { organization, isLoaded: organizationLoaded } = useOrganization();
  const { isLoaded, userInvitations, userMemberships, setActive } = useOrganizationList({
    userInvitations: { status: "pending", infinite: true },
    userMemberships: { infinite: true },
  });
  const [step, setStep] = useState<"invitations" | "create">("invitations");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joinedCircle, setJoinedCircle] = useState<{ id: string; name: string } | null>(null);
  const pending = useRef(false);

  // When org becomes active after accepting an invitation,
  // redirect to dashboard. Circle creation uses Clerk's
  // afterCreateOrganizationUrl to redirect to /dashboard
  // directly, which survives component remounts.
  // Note: only redirect, don't setState — avoids cascading renders.
  useEffect(() => {
    if (organization && step !== "create" && !pending.current) {
      router.replace("/dashboard");
    }
  }, [organization, step, router]);

  if (!isLoaded || !organizationLoaded || userInvitations.isLoading || userMemberships.isLoading) {
    return (
      <div role="status" aria-label="Loading circles" className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (organization && step !== "create") {
    return (
      <p role="status">Opening your Circle…</p>
    );
  }

  const pendingInvitations = (userInvitations?.data ?? []).filter(
    (invitation) => invitation.publicOrganizationData.id !== joinedCircle?.id,
  );
  const memberships = userMemberships?.data ?? [];

  const openCircle = async (organizationId: string, invitationId?: string) => {
    if (pending.current || !setActive) return;
    pending.current = true;
    setPendingId(invitationId ?? organizationId);
    setError(null);
    try {
      if (invitationId) {
        const invitation = pendingInvitations.find((inv) => inv.id === invitationId);
        if (!invitation) throw new Error("Invitation unavailable");
        await invitation.accept();
        setJoinedCircle({ id: organizationId, name: invitation.publicOrganizationData.name });
      }
      await setActive({ organization: organizationId });
      router.replace("/dashboard");
      router.refresh();
      // Keep actions disabled until navigation completes.
    } catch {
      pending.current = false;
      setPendingId(null);
      setError("Unable to open this Circle. Please try again.");
    }
  };

  return (
    <div className="space-y-6">
      {joinedCircle && pendingId !== null && <p role="status">Opening {joinedCircle.name}…</p>}
      {error && (
        <div className="space-y-2">
          <p role="alert" className="text-sm text-destructive">{error}</p>
          {joinedCircle && (
            <Button disabled={pendingId !== null} onClick={() => openCircle(joinedCircle.id)}>
              Open {joinedCircle.name}
            </Button>
          )}
        </div>
      )}
      {(userInvitations.error || userMemberships.error) && (
        <div role="alert" className="space-y-2 text-sm text-destructive">
          <p>Unable to load your Circles. Please try again.</p>
          <Button variant="outline" onClick={() => {
            void userInvitations.revalidate?.();
            void userMemberships.revalidate?.();
          }}>Try again</Button>
        </div>
      )}
      {step === "invitations" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Pending Circle Invitations
            </CardTitle>
          </CardHeader>
          <CardContent>
            {memberships.length > 0 && (
              <div className="mb-6 space-y-3">
                <h2 className="font-semibold">Your Circles</h2>
                {memberships.map(({ organization: circle }) => (
                  <div key={circle.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <span>{circle.name}</span>
                    <Button size="sm" disabled={pendingId !== null} onClick={() => openCircle(circle.id)}>
                      {pendingId === circle.id ? "Opening…" : "Open"}
                    </Button>
                  </div>
                ))}
                {userMemberships.hasNextPage && (
                  <Button variant="outline" disabled={userMemberships.isFetching || pendingId !== null} onClick={() => userMemberships.fetchNext?.()}>
                    More Circles
                  </Button>
                )}
              </div>
            )}
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
                      disabled={pendingId !== null}
                      onClick={() => openCircle(invitation.publicOrganizationData.id, invitation.id)}
                    >
                      {pendingId === invitation.id ? "Joining…" : "Join"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {userInvitations.hasNextPage && (
              <Button variant="outline" disabled={userInvitations.isFetching || pendingId !== null} onClick={() => userInvitations.fetchNext?.()}>
                More invitations
              </Button>
            )}
          </CardContent>
          <CardFooter>
            <Button variant="outline" disabled={pendingId !== null} onClick={() => setStep("create")}>
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
              afterCreateOrganizationUrl="/dashboard"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
