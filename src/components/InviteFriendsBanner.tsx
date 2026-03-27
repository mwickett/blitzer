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
