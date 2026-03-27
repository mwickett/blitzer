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
import { XCircle, Loader2, UserPlus } from "lucide-react";

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
