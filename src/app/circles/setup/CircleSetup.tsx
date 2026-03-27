"use client";

import { useState, useEffect } from "react";
import {
  useOrganizationList,
  useOrganization,
  CreateOrganization,
} from "@clerk/nextjs";
import { useRouter } from "next/navigation";
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
import { CheckCircle2, XCircle, Loader2, UserPlus, Users } from "lucide-react";

type SetupStep = "invitations" | "create" | "invite-friends";

type Friend = {
  id: string;
  username: string;
  email: string;
};

interface CircleSetupProps {
  friends: Friend[];
  hasCircle: boolean;
}

export default function CircleSetup({ friends, hasCircle }: CircleSetupProps) {
  const router = useRouter();
  const { organization } = useOrganization();
  const { isLoaded, userInvitations } = useOrganizationList({
    userInvitations: { status: "pending" },
  });

  // If user already has a circle (from server), skip to friend migration
  const [step, setStep] = useState<SetupStep>(
    hasCircle ? "invite-friends" : "invitations"
  );
  const [invitedFriends, setInvitedFriends] = useState<Set<string>>(new Set());
  const [inviteErrors, setInviteErrors] = useState<Map<string, string>>(new Map());
  const [inviting, setInviting] = useState<string | null>(null);

  // When org becomes active mid-flow (after creating or accepting),
  // move to friend migration. Must be in useEffect, not during render.
  useEffect(() => {
    if (organization && step !== "invite-friends") {
      setStep("invite-friends");
    }
  }, [organization, step]);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const pendingInvitations = userInvitations?.data ?? [];

  const handleAcceptInvitation = async (invitationId: string) => {
    const invitation = pendingInvitations.find((inv) => inv.id === invitationId);
    if (!invitation) return;

    try {
      await invitation.accept();
    } catch (error) {
      console.error("Failed to accept invitation:", error);
    }
  };

  const handleInviteFriend = async (friend: Friend) => {
    setInviting(friend.id);
    const result = await inviteFriendToCircle(friend.email);

    if (result.success) {
      setInvitedFriends((prev) => new Set(prev).add(friend.id));
      setInviteErrors((prev) => {
        const next = new Map(prev);
        next.delete(friend.id);
        return next;
      });
    } else {
      setInviteErrors((prev) => new Map(prev).set(friend.id, result.error ?? "Failed"));
    }
    setInviting(null);
  };

  const handleFinish = () => {
    router.push("/dashboard");
  };

  return (
    <div className="space-y-6">
      {/* Step 1: Pending invitations */}
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
            <Button
              variant="outline"
              onClick={() => setStep("create")}
            >
              Create a new circle instead
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 2: Create a circle */}
      {step === "create" && (
        <Card>
          <CardHeader>
            <CardTitle>Create Your Circle</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateOrganization
              skipInvitationScreen={true}
              afterCreateOrganizationUrl="/circles/setup"
            />
          </CardContent>
        </Card>
      )}

      {/* Step 3: Invite friends */}
      {step === "invite-friends" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Invite Your Friends
            </CardTitle>
          </CardHeader>
          <CardContent>
            {friends.length === 0 ? (
              <p className="text-muted-foreground">
                No friends to migrate. You can invite people from circle
                settings later.
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground mb-4">
                  These are your existing Blitzer friends. Invite them to your
                  new circle so you can keep playing together.
                </p>
                {friends.map((friend) => (
                  <div
                    key={friend.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{friend.username}</span>
                      {invitedFriends.has(friend.id) && (
                        <Badge variant="secondary" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Invited
                        </Badge>
                      )}
                      {inviteErrors.has(friend.id) && (
                        <Badge variant="destructive" className="gap-1">
                          <XCircle className="h-3 w-3" />
                          {inviteErrors.get(friend.id)}
                        </Badge>
                      )}
                    </div>
                    {!invitedFriends.has(friend.id) && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={inviting === friend.id}
                        onClick={() => handleInviteFriend(friend)}
                      >
                        {inviting === friend.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Invite"
                        )}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button onClick={handleFinish}>
              Go to Dashboard
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
