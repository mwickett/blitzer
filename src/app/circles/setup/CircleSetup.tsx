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
  // Note: only redirect, don't setState — avoids cascading renders.
  useEffect(() => {
    if (organization && step !== "done" && step !== "create") {
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
